import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createR2Client } from './lib/r2-client.mjs';

const prefix = 'kuro/model-library/';
export function createModelStorage(
  env = process.env,
  { client: injectedClient } = {},
) {
  if (env.MODEL_STORAGE !== 'r2') {
    if (env.RAILWAY_ENVIRONMENT_ID)
      throw new Error('Production model uploads require MODEL_STORAGE=r2');
    return null;
  }
  const key = Buffer.from(env.MODEL_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32)
    throw new Error('MODEL_ENCRYPTION_KEY must contain 32 bytes');
  const client = injectedClient || createR2Client(env, { prefix });
  const bucket = env.R2_BUCKET_NAME;
  const objectKey = (value) => {
    if (!/^kuro\/model-library\/[a-f0-9]{64}\.bin$/.test(value))
      throw new Error('Invalid model storage key');
    return value;
  };
  return {
    async put(bytes) {
      const object = `${prefix}${randomBytes(32).toString('hex')}.bin`;
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(object));
      const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
      const body = Buffer.concat([
        Buffer.from('KMR1'),
        iv,
        cipher.getAuthTag(),
        encrypted,
      ]);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: object,
          Body: body,
          ContentType: 'application/octet-stream',
          CacheControl: 'private, no-store',
          ContentMD5: createHash('md5').update(body).digest('base64'),
          Metadata: {
            'managed-by': 'kuro-model-library',
            format: 'aes-256-gcm-v1',
          },
          IfNoneMatch: '*',
        }),
      );
      return object;
    },
    async get(object) {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey(object) }),
      );
      const bytes = Buffer.from(await response.Body.transformToByteArray());
      if (bytes.length < 32 || bytes.toString('ascii', 0, 4) !== 'KMR1')
        throw new Error('Invalid stored model');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        bytes.subarray(4, 16),
      );
      decipher.setAAD(Buffer.from(object));
      decipher.setAuthTag(bytes.subarray(16, 32));
      return Buffer.concat([
        decipher.update(bytes.subarray(32)),
        decipher.final(),
      ]);
    },
    close: () => client.destroy(),
  };
}

// Only the six reviewed built-in exhibit assets may be served through this route.
export async function createExhibitAssetHandler(root, env = process.env) {
  if (env.MODEL_STORAGE !== 'r2') return async () => false;
  const catalog = JSON.parse(
    await readFile(new URL('../config/exhibit-catalog.json', import.meta.url)),
  );
  const manifest = JSON.parse(
    await readFile(`${root}/assets/manifests/assets.json`),
  );
  const paths = new Map();
  for (const item of catalog)
    for (const id of [item.assetId, item.roomAssetId]) {
      const asset = manifest.assets[id];
      if (!asset) throw new Error(`Missing R2 exhibit manifest entry: ${id}`);
      paths.set('/assets/' + asset.path, asset);
    }
  const client = createR2Client(env);
  return async (req, res) => {
    const asset = paths.get(new URL(req.url, 'http://localhost').pathname);
    if (!asset || !['GET', 'HEAD'].includes(req.method)) return false;
    try {
      if (req.headers['if-none-match'] === `"${asset.sha256}"`) {
        res.writeHead(304, { ETag: `"${asset.sha256}"` });
        res.end();
        return true;
      }
      const response = await client.send(
        new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: 'kuro/' + asset.path,
        }),
      );
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': asset.size,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${asset.sha256}"`,
        'X-Content-Type-Options': 'nosniff',
        'X-Model-Storage': 'r2',
      });
      if (req.method === 'HEAD') {
        response.Body.destroy();
        res.end();
      } else response.Body.on('error', () => res.destroy()).pipe(res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(503, { 'Cache-Control': 'no-store' });
        res.end('Model storage temporarily unavailable');
      } else res.destroy();
    }
    return true;
  };
}
