import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createR2Client } from './lib/r2-client.mjs';

// The user's 2026-09-14 R2 request authorizes these six model files only.
// Never upload images, unrelated models, directories or a global asset manifest here.
const catalog = JSON.parse(
  await readFile(
    new URL('../app/generated/asset-manifest.json', import.meta.url),
  ),
);
const client = createR2Client(process.env, { prefix: 'kuro/models/exhibits/' });
const report = [];
try {
  for (const model of ['seraph', 'reaper', 'aureole'])
    for (const version of ['room', 'detail']) {
      const id = `exhibit.${model}.${version}`,
        asset = catalog.assets[id];
      if (!asset?.publish || !asset.path.startsWith('models/exhibits/'))
        throw Error('Unapproved exhibit');
      const bytes = await readFile(
        new URL('../public/assets/' + asset.path, import.meta.url),
      );
      const sha = (data) => createHash('sha256').update(data).digest('hex');
      if (bytes.length !== asset.size || sha(bytes) !== asset.sha256)
        throw Error('Local model checksum mismatch');
      const params = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: 'kuro/' + asset.path,
      };
      let exists = false;
      try {
        const remote = await client.send(new HeadObjectCommand(params));
        if (
          remote.ContentLength !== bytes.length ||
          remote.Metadata?.sha256 !== asset.sha256
        )
          throw Error('Existing model does not match; refusing overwrite');
        exists = true;
      } catch (error) {
        if (error.$metadata?.httpStatusCode !== 404) throw error;
      }
      if (!exists)
        await client.send(
          new PutObjectCommand({
            ...params,
            Body: bytes,
            IfNoneMatch: '*',
            ContentType: 'model/gltf-binary',
            CacheControl: 'public, max-age=31536000, immutable',
            ContentMD5: createHash('md5').update(bytes).digest('base64'),
            Metadata: { sha256: asset.sha256, 'managed-by': 'kuro-assets' },
          }),
        );
      const remote = await client.send(new GetObjectCommand(params));
      if (sha(await remote.Body.transformToByteArray()) !== asset.sha256)
        throw Error('R2 checksum mismatch');
      report.push({
        id,
        bytes: bytes.length,
        action: exists ? 'verified' : 'uploaded',
        checksum: 'match',
      });
    }
  await mkdir('output/private-model-check', { recursive: true });
  await writeFile(
    'output/private-model-check/r2-exhibits.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  client.destroy();
}
