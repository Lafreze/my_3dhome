import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createR2Client, scopedCredentials } from './lib/r2-client.mjs';
import {
  createExhibitAssetHandler,
  createModelStorage,
} from './model-storage.mjs';

const env = {
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-only-secret',
  R2_BUCKET_NAME: 'test',
};
const claimsOf = (credentials) =>
  JSON.parse(
    Buffer.from(
      Buffer.from(credentials.sessionToken, 'base64')
        .toString()
        .slice(4)
        .split('.')[1],
      'base64url',
    ),
  );

test('the same long-lived R2 SDK client renews its credentials before their one-hour expiration', async (t) => {
  const client = createR2Client(env);
  t.after(() => client.destroy());
  const first = await client.config.credentials();
  assert.equal(first.expiration.getTime(), claimsOf(first).exp * 1000);
  const clock = Date.now;
  t.mock.method(Date, 'now', () => clock() + 58 * 60000);
  const renewed = await client.config.credentials();
  assert.notEqual(first.sessionToken, renewed.sessionToken);
  assert(renewed.expiration.getTime() > Date.now() + 59 * 60000);
  assert.deepEqual(claimsOf(renewed).paths.prefixPaths, ['kuro/']);
  assert(!claimsOf(renewed).actions.includes('DeleteObject'));
});

test('uploaded model deletion is limited to the encrypted library prefix and one validated key', async () => {
  const scoped = scopedCredentials(
    env,
    'https://account.r2.cloudflarestorage.com',
    true,
    'kuro/model-library/',
  );
  assert.deepEqual(claimsOf(scoped).paths.prefixPaths, ['kuro/model-library/']);
  assert(claimsOf(scoped).actions.includes('DeleteObject'));
  const commands = [];
  const storage = createModelStorage(
    {
      ...env,
      MODEL_STORAGE: 'r2',
      MODEL_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'),
    },
    {
      client: {
        send: async (command) => {
          commands.push(command);
          return {};
        },
        destroy() {},
      },
    },
  );
  const key = 'kuro/model-library/' + 'a'.repeat(64) + '.bin';
  await storage.remove(key);
  assert.equal(commands[0].constructor.name, 'DeleteObjectCommand');
  assert.deepEqual(commands[0].input, { Bucket: 'test', Key: key });
  for (const invalid of [
    'kuro/models/exhibits/seraph.glb',
    '../catalog.json',
    key + '/more',
    'kuro/model-library/',
  ])
    await assert.rejects(storage.remove(invalid));
  assert.equal(commands.length, 1);
});

test('built-in exhibits survive unavailable, truncated or corrupt R2 reads using only an identical bundled copy', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'kuro-exhibit-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('reviewed built-in model fixture'),
    sha256 = createHash('sha256').update(bytes).digest('hex');
  const catalog = JSON.parse(
    await readFile(new URL('../config/exhibit-catalog.json', import.meta.url)),
  );
  const assets = {};
  await mkdir(join(root, 'assets/manifests'), { recursive: true });
  for (const item of catalog)
    for (const id of [item.assetId, item.roomAssetId]) {
      const path = `${id}.glb`;
      assets[id] = { path, logicalPath: path, size: bytes.length, sha256 };
      await writeFile(join(root, 'assets', path), bytes);
    }
  await writeFile(
    join(root, 'assets/manifests/assets.json'),
    JSON.stringify({ assets }),
  );
  let mode = 'good';
  const handler = await createExhibitAssetHandler(
    root,
    { ...env, MODEL_STORAGE: 'r2' },
    {
      client: {
        async send() {
          if (mode === 'unavailable') throw Error('R2 outage');
          return {
            Body: {
              async transformToByteArray() {
                if (mode === 'truncated') throw Error('stream interrupted');
                return mode === 'corrupt' ? Buffer.alloc(bytes.length) : bytes;
              },
            },
          };
        },
      },
    },
  );
  const server = createServer(async (req, res) => {
    if (!(await handler(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`,
    path = '/assets/' + assets[catalog[0].roomAssetId].path;
  for (mode of ['good', 'unavailable', 'truncated', 'corrupt']) {
    const r = await fetch(origin + path);
    assert.equal(r.status, 200, mode);
    assert.equal(
      r.headers.get('x-model-storage'),
      mode === 'good' ? 'r2' : 'bundled-fallback',
    );
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
  }
  assert.equal((await fetch(origin + path, { method: 'HEAD' })).status, 200);
  assert.equal(
    (
      await fetch(origin + path, {
        headers: { 'If-None-Match': `"${sha256}"` },
      })
    ).status,
    304,
  );
  for (const path of [
    '/api/models/test.glb',
    '/assets/other.glb',
    '/assets/../model-library/test.bin',
  ])
    assert.equal((await fetch(origin + path)).status, 404);
  await writeFile(
    join(root, 'assets', assets[catalog[0].roomAssetId].path),
    Buffer.from('bad fallback'),
  );
  assert.equal((await fetch(origin + path)).status, 503);
});
