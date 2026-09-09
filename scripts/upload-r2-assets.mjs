import { readFile, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { prepareAssets } from './prepare-assets.mjs';
import { createR2Client } from './lib/r2-client.mjs';
import {
  PREFIX,
  IMMUTABLE,
  MANIFEST_CACHE,
  objectKey,
  contentType,
  publicManifest,
  sha256,
} from './lib/asset-policy.mjs';

export async function uploadAssets({
  manifest,
  source = 'public/assets',
  client,
  bucket,
  dryRun = false,
  prune = false,
  keepDays = 30,
  log = console.log,
}) {
  if (prune && (!client || !Number.isInteger(keepDays) || keepDays < 1))
    throw new Error('Prune requires R2 credentials and keep-days >= 1');
  const publicData = publicManifest(manifest);
  const counts = {
    added: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    excluded:
      Object.keys(manifest.assets).length -
      Object.keys(publicData.assets).length,
    pruned: 0,
  };
  const base = await realpath(source);
  const objects = [];
  // Preflight all bytes and dependency closure before making any remote writes.
  for (const [id, asset] of Object.entries(publicData.assets)) {
    const key = objectKey(PREFIX + asset.path);
    if (!/\.[a-f0-9]{16}\.[a-z0-9]+$/.test(key))
      throw new Error(`Missing content hash: ${id}`);
    const file = path.resolve(base, asset.path);
    if (
      !file.startsWith(base + path.sep) ||
      (await realpath(file)) !== file ||
      !(await lstat(file)).isFile()
    )
      throw new Error(`Unsafe source: ${id}`);
    const bytes = await readFile(file);
    if (
      sha256(bytes) !== asset.sha256 ||
      bytes.length !== asset.size ||
      !key.includes(`.${asset.sha256.slice(0, 16)}.`)
    )
      throw new Error(`Changed bytes: ${id}; run assets:prepare`);
    const type = contentType(asset.path);
    if (asset.contentType !== type) throw new Error(`Incorrect MIME: ${id}`);
    for (const dep of asset.dependencies || [])
      if (!publicData.assets[dep])
        throw new Error(`Unapproved dependency: ${dep}`);
    objects.push({ key, bytes, type, cache: IMMUTABLE });
  }
  const manifestBytes = Buffer.from(JSON.stringify(publicData, null, 2) + '\n');
  objects.push({
    key: objectKey(
      `kuro/manifests/assets.${sha256(manifestBytes).slice(0, 16)}.json`,
    ),
    bytes: manifestBytes,
    type: 'application/json',
    cache: IMMUTABLE,
  });
  const currentKey = 'kuro/manifests/assets.json';
  const mutable = {
    key: currentKey,
    bytes: manifestBytes,
    type: 'application/json',
    cache: MANIFEST_CACHE,
  };
  const head = async (key) => {
    try {
      return await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
      );
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 404 || error.name === 'NotFound')
        return null;
      throw error;
    }
  };
  async function put(item) {
    try {
      const previous = client ? await head(item.key) : null;
      const digest = sha256(item.bytes);
      if (previous && previous.Metadata?.['managed-by'] !== 'kuro-assets')
        throw new Error('Refusing to overwrite an unmanaged object');
      if (
        previous?.Metadata?.sha256 === digest &&
        previous.ContentLength === item.bytes.length &&
        previous.ContentType === item.type &&
        previous.CacheControl === item.cache
      ) {
        counts.skipped++;
        log(`SKIP ${item.key}`);
        return;
      }
      if (
        previous &&
        item.cache === IMMUTABLE &&
        previous.Metadata?.sha256 &&
        previous.Metadata.sha256 !== digest
      )
        throw new Error('Immutable key collision');
      const action = previous ? 'updated' : 'added';
      if (!dryRun) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey(item.key),
            Body: item.bytes,
            ContentType: item.type,
            ContentLength: item.bytes.length,
            CacheControl: item.cache,
            ContentMD5: createHash('md5').update(item.bytes).digest('base64'),
            Metadata: { sha256: digest, 'managed-by': 'kuro-assets' },
            // Refuse concurrent replacement of the live manifest.
            ...(item.key === currentKey
              ? previous?.ETag
                ? { IfMatch: previous.ETag }
                : { IfNoneMatch: '*' }
              : {}),
          }),
        );
        const verified = await head(item.key);
        if (
          !verified?.ETag ||
          verified.Metadata?.sha256 !== digest ||
          verified.ContentLength !== item.bytes.length ||
          verified.ContentType !== item.type ||
          verified.CacheControl !== item.cache
        )
          throw new Error('Upload metadata verification failed');
      }
      counts[action]++;
      log(
        `${dryRun ? 'PLAN ' : ''}${action.toUpperCase()} ${item.key} ${item.bytes.length} bytes`,
      );
    } catch (error) {
      counts.failed++;
      // SDK error messages can contain endpoints and request details; log only a safe error class/status.
      log(
        `FAILED ${item.key} (${String(error.name || 'Error').replace(/[^a-zA-Z0-9_-]/g, '')}, HTTP ${error.$metadata?.httpStatusCode || 'unknown'})`,
      );
    }
  }
  for (const item of objects) await put(item);
  if (!counts.failed) await put(mutable);
  else log('Manifest was not changed because one or more uploads failed.');
  if (prune && !counts.failed) {
    const currentEtag = (await head(currentKey))?.ETag;
    const listed = [];
    let continuation;
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: PREFIX,
          ContinuationToken: continuation,
        }),
      );
      for (const object of page.Contents || []) {
        objectKey(object.Key);
        listed.push(object);
      }
      continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (page.IsTruncated && !continuation)
        throw new Error('Incomplete object listing; prune stopped');
    } while (continuation);
    const keep = new Set([...objects.map((o) => o.key), currentKey]);
    const cutoff = Date.now() - keepDays * 86400000;
    // Preserve resources referenced by recent releases as well as this release.
    for (const object of listed.filter(
      (o) =>
        /^kuro\/manifests\/assets\.[a-f0-9]{16}\.json$/.test(o.Key) &&
        +new Date(o.LastModified) >= cutoff,
    )) {
      const snapshot = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey(object.Key) }),
      );
      const old = JSON.parse(await snapshot.Body.transformToString());
      for (const asset of Object.values(old.assets))
        keep.add(objectKey(PREFIX + asset.path));
      keep.add(object.Key);
    }
    const candidates = [];
    for (const object of listed) {
      if (
        keep.has(object.Key) ||
        !object.LastModified ||
        +new Date(object.LastModified) >= cutoff ||
        !/\.[a-f0-9]{16}\.[a-z0-9]+$/.test(object.Key)
      )
        continue;
      const metadata = await head(object.Key);
      if (metadata?.Metadata?.['managed-by'] === 'kuro-assets')
        candidates.push(object.Key);
    }
    log(
      `PRUNE candidates (${candidates.length}, retaining ${keepDays} days of releases):`,
    );
    candidates.forEach((key) => log(key));
    if (!dryRun && (await head(currentKey))?.ETag !== currentEtag)
      throw new Error(
        'Live manifest changed during prune planning; retry without concurrent publication',
      );
    if (!dryRun)
      for (const key of candidates) {
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
          );
          counts.pruned++;
        } catch {
          counts.failed++;
          log(`FAILED delete ${key}`);
        }
      }
  }
  log(JSON.stringify({ dryRun, remoteCompared: !!client, ...counts }));
  return counts;
}
async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean' },
      prune: { type: 'boolean' },
      source: { type: 'string' },
      'keep-days': { type: 'string', default: '30' },
    },
  });
  const { manifest } = await prepareAssets();
  const hasCredentials = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ].every((key) => process.env[key]);
  const client =
    hasCredentials || !values['dry-run'] || values.prune
      ? createR2Client(process.env, { prune: !!values.prune })
      : null;
  if (!client)
    console.log(
      'Offline dry-run: validates bytes/approval/paths; remote added/updated/skipped cannot be determined.',
    );
  try {
    const counts = await uploadAssets({
      manifest,
      client,
      bucket: process.env.R2_BUCKET_NAME,
      source: values.source || 'public/assets',
      dryRun: !!values['dry-run'],
      prune: !!values.prune,
      keepDays: Number(values['keep-days']),
    });
    if (counts.failed) process.exitCode = 1;
  } finally {
    client?.destroy();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    // Print our setup errors only. Do not dump SDK objects or credentials.
    console.error(
      error.$metadata ? `R2 request failed (${error.name})` : error.message,
    );
    process.exitCode = 1;
  });
