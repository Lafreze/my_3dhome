import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { assetUrl } from '../app/asset-url.ts';
import { prepareAssets } from './prepare-assets.mjs';
import { uploadAssets } from './upload-r2-assets.mjs';
import { scopedCredentials } from './lib/r2-client.mjs';
import {
  sha256,
  hashedPath,
  objectKey,
  IMMUTABLE,
  MANIFEST_CACHE,
} from './lib/asset-policy.mjs';

void test('URL joining, immutable resolution, local pending models, and traversal rejection', () => {
  assert.equal(
    assetUrl('/models//rooms/cafe/a.glb', 'https://assets.kuro.cafe//kuro///'),
    'https://assets.kuro.cafe/kuro/models/rooms/cafe/a.glb',
  );
  assert.equal(assetUrl('models/a.glb', ''), '/assets/models/a.glb');
  assert.equal(
    assetUrl('https://example.com/model.glb?version=1'),
    'https://example.com/model.glb?version=1',
  );
  assert.match(
    assetUrl('character.bear.sit', 'https://assets.kuro.cafe/kuro'),
    /^\/assets\/models\/characters\/bear\/sit\.[a-f0-9]{16}\.glb$/,
  );
  for (const value of [
    '../secret',
    'a/../secret',
    'a/%2e%2e/secret',
    'a\\b',
    '//evil.test/a',
    'data:text/plain,secret',
  ])
    assert.throws(() => assetUrl(value));
  assert.throws(() => assetUrl('a.glb', 'https://key:secret@example.com'));
  assert.throws(() => objectKey('other/file.glb'));
  assert.throws(() => objectKey('kuro/../other/file.glb'));
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kuro-assets-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(
    ['public', 'assets', 'config'].map((dir) => mkdir(path.join(root, dir))),
  );
  const catalog = { assets: [] };
  const add = async (id, source, logicalPath, bytes, extra = {}) => {
    await mkdir(path.dirname(path.join(root, source)), { recursive: true });
    await writeFile(path.join(root, source), bytes);
    catalog.assets.push({
      id,
      source,
      path: logicalPath,
      type: 'model',
      room: 'gallery',
      rooms: ['gallery'],
      approval: 'approved',
      author: 'Test',
      license: 'CC0-1.0',
      modifications: 'Test fixture',
      ...extra,
    });
  };
  const save = () =>
    writeFile(
      path.join(root, 'config/asset-catalog.json'),
      JSON.stringify(catalog),
    );
  return { root, catalog, add, save };
}

void test('glTF dependency filenames follow their content hash and unchanged builds are deterministic', async (t) => {
  const f = await fixture(t);
  await f.add(
    'buffer',
    'public/scene/data.bin',
    'models/common/data.bin',
    Buffer.from('buffer'),
  );
  await f.add(
    'room.gallery',
    'public/scene/model.gltf',
    'models/rooms/gallery/model.gltf',
    JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'data.bin', byteLength: 6 }],
    }),
    { dependencies: { 'data.bin': 'buffer' } },
  );
  await f.save();
  const first = await prepareAssets({ root: f.root });
  const second = await prepareAssets({ root: f.root });
  assert.deepEqual(first.manifest, second.manifest);
  const asset = first.manifest.assets['room.gallery'];
  const gltf = JSON.parse(
    await readFile(path.join(f.root, 'public/assets', asset.path)),
  );
  assert.match(
    gltf.buffers[0].uri,
    /^\.\.\/\.\.\/common\/data\.[a-f0-9]{16}\.bin$/,
  );
  await writeFile(path.join(f.root, 'public/scene/data.bin'), 'changed buffer');
  const third = await prepareAssets({ root: f.root });
  assert.notEqual(
    third.manifest.assets.buffer.path,
    first.manifest.assets.buffer.path,
  );
  assert.notEqual(
    third.manifest.assets['room.gallery'].path,
    first.manifest.assets['room.gallery'].path,
  );
});

void test('raw formats, >2K textures, symlinks and unreviewed dependencies fail closed', async (t) => {
  const f = await fixture(t);
  await f.add('raw', 'public/raw.obj', 'models/raw.glb', 'source');
  await f.save();
  await assert.rejects(prepareAssets({ root: f.root }), /Forbidden/);
  f.catalog.assets = [];
  const raw = await sharp({
    create: { width: 4096, height: 1, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  await f.add('huge', 'public/huge.png', 'textures/huge.png', raw);
  await f.save();
  await assert.rejects(prepareAssets({ root: f.root }), /4K\/8K/);
  f.catalog.assets = [];
  await f.add('link', 'public/link.bin', 'models/link.bin', '123');
  await rm(path.join(f.root, 'public/link.bin'));
  await symlink(
    path.join(f.root, 'public/huge.png'),
    path.join(f.root, 'public/link.bin'),
  );
  await f.save();
  await assert.rejects(prepareAssets({ root: f.root }), /regular in-project/);
  f.catalog.assets = [];
  await f.add(
    'model',
    'public/model.gltf',
    'models/model.gltf',
    JSON.stringify({ buffers: [{ uri: 'unreviewed.bin' }] }),
  );
  await f.save();
  await assert.rejects(prepareAssets({ root: f.root }), /Unreviewed/);
});

void test('container build excludes authoring sources and rejects production manifest drift', async (t) => {
  const f = await fixture(t);
  await f.add(
    'model',
    'public/model.bin',
    'models/model.bin',
    Buffer.from('reviewed'),
  );
  await f.save();
  await rm(path.join(f.root, 'assets'), { recursive: true });
  const first = await prepareAssets({ root: f.root });
  assert.equal(first.report.inventory.length, 1);
  await prepareAssets({ root: f.root, checkManifest: true });
  await writeFile(path.join(f.root, 'public/model.bin'), 'unreviewed change');
  await assert.rejects(
    prepareAssets({ root: f.root, checkManifest: true }),
    /reviewed manifest/,
  );
  const retained = JSON.parse(
    await readFile(path.join(f.root, 'app/generated/asset-manifest.json')),
  );
  assert.equal(retained.version, first.manifest.version);
  await assert.rejects(
    prepareAssets({ root: f.root, output: 'public' }),
    /restricted/,
  );
});

class MemoryR2 {
  objects = new Map();
  calls = [];
  failKey;
  async send(command) {
    const { Key, Prefix, Body, ...input } = command.input;
    this.calls.push({
      name: command.constructor.name,
      key: Key,
      prefix: Prefix,
    });
    if (Key) objectKey(Key);
    switch (command.constructor.name) {
      case 'HeadObjectCommand': {
        const object = this.objects.get(Key);
        if (!object)
          throw Object.assign(new Error(), {
            name: 'NotFound',
            $metadata: { httpStatusCode: 404 },
          });
        return object;
      }
      case 'PutObjectCommand':
        if (Key === this.failKey)
          throw Object.assign(new Error(), { name: 'NetworkError' });
        this.objects.set(Key, {
          ...input,
          Body,
          ETag: '"test-etag"',
          ContentLength: Body.length,
          LastModified: new Date(),
        });
        return {};
      case 'ListObjectsV2Command':
        assert.equal(Prefix, 'kuro/');
        return {
          Contents: [...this.objects]
            .filter(([key]) => key.startsWith(Prefix))
            .map(([key, value]) => ({
              Key: key,
              LastModified: value.LastModified,
            })),
        };
      case 'GetObjectCommand':
        return {
          Body: {
            transformToString: async () =>
              this.objects.get(Key).Body.toString(),
          },
        };
      case 'DeleteObjectCommand':
        this.objects.delete(Key);
        return {};
      default:
        throw new Error('Unexpected S3 operation');
    }
  }
}
async function uploadFixture(t) {
  const f = await fixture(t);
  await f.add(
    'approved',
    'public/model.bin',
    'models/common/model.bin',
    Buffer.from('test bytes'),
  );
  await f.add(
    'pending',
    'public/pending.bin',
    'models/common/pending.bin',
    Buffer.from('private bytes'),
    { approval: 'pending' },
  );
  await f.save();
  const { manifest } = await prepareAssets({ root: f.root });
  return {
    ...f,
    manifest,
    client: new MemoryR2(),
    source: path.join(f.root, 'public/assets'),
    bucket: 'test',
    log: () => {},
  };
}
void test('upload skips unchanged data, publishes manifest last, and excludes unapproved bytes', async (t) => {
  const f = await uploadFixture(t);
  const counts = await uploadAssets(f);
  assert.equal(counts.added, 3);
  assert.equal(counts.excluded, 1);
  assert.equal(counts.failed, 0);
  assert.equal(
    f.client.calls.filter((c) => c.name === 'PutObjectCommand').at(-1).key,
    'kuro/manifests/assets.json',
  );
  assert.equal(
    f.client.objects.get('kuro/manifests/assets.json').CacheControl,
    MANIFEST_CACHE,
  );
  assert.equal(
    f.client.objects.get('kuro/' + f.manifest.assets.approved.path)
      .CacheControl,
    IMMUTABLE,
  );
  assert.equal((await uploadAssets(f)).skipped, 3);
  assert(![...f.client.objects.keys()].some((key) => key.includes('pending')));
  const before = f.client.objects.get('kuro/manifests/assets.json').Body;
  f.client.objects.delete('kuro/' + f.manifest.assets.approved.path);
  f.client.failKey = 'kuro/' + f.manifest.assets.approved.path;
  assert.equal((await uploadAssets(f)).failed, 1);
  assert.deepEqual(
    f.client.objects.get('kuro/manifests/assets.json').Body,
    before,
  );
});
void test('dry-run does not mutate; tampered staged bytes stop all writes', async (t) => {
  const f = await uploadFixture(t);
  await uploadAssets({ ...f, dryRun: true });
  assert.equal(f.client.objects.size, 0);
  await writeFile(
    path.join(f.source, f.manifest.assets.approved.path),
    'tampered',
  );
  await assert.rejects(uploadAssets(f), /Changed bytes/);
  assert.equal(
    f.client.calls.filter((c) => c.name === 'PutObjectCommand').length,
    0,
  );
});
void test('prune lists full keys, preserves recent releases and unmanaged objects, and never crosses prefix', async (t) => {
  const f = await uploadFixture(t);
  await uploadAssets(f);
  const oldKey = 'kuro/models/common/old.aaaaaaaaaaaaaaaa.bin';
  const unmanaged = 'kuro/models/common/other.bbbbbbbbbbbbbbbb.bin';
  const old = {
    LastModified: new Date('2020-01-01'),
    Metadata: { 'managed-by': 'kuro-assets' },
  };
  f.client.objects.set(oldKey, old);
  f.client.objects.set(unmanaged, { ...old, Metadata: {} });
  f.client.objects.set('unrelated/secret.bin', old);
  await uploadAssets(f);
  assert(f.client.objects.has(oldKey));
  const logs = [];
  await uploadAssets({
    ...f,
    prune: true,
    dryRun: true,
    log: (line) => logs.push(line),
  });
  assert(logs.includes(oldKey));
  assert(f.client.objects.has(oldKey));
  const counts = await uploadAssets({ ...f, prune: true });
  assert.equal(counts.pruned, 1);
  assert(!f.client.objects.has(oldKey));
  assert(f.client.objects.has(unmanaged));
  assert(f.client.objects.has('unrelated/secret.bin'));
});
void test('upload credentials are restricted to one bucket, kuro/, and no delete by default', () => {
  const env = {
    R2_ACCOUNT_ID: 'account',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'test-only-secret',
    R2_BUCKET_NAME: 'test',
  };
  const credentials = scopedCredentials(
    env,
    'https://account.r2.cloudflarestorage.com',
  );
  const jwt = Buffer.from(credentials.sessionToken, 'base64')
    .toString()
    .slice(4);
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url'));
  assert.equal(claims.bucket, 'test');
  assert.deepEqual(claims.paths.prefixPaths, ['kuro/']);
  assert(!claims.actions.includes('DeleteObject'));
  assert(!claims.actions.includes('DeleteBucket'));
  assert.equal(credentials.secretAccessKey, sha256(jwt));
  assert.equal(
    hashedPath('models/a.bin', Buffer.from('a')),
    hashedPath('models/a.bin', Buffer.from('a')),
  );
});
