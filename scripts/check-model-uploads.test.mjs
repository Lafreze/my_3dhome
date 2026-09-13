import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createHouseHandler } from './house-settings.mjs';
import { MAX_MODEL_BYTES, validateModelGlb } from './model-library.mjs';
const tiny = await readFile(
  new URL('../public/models/exhibits/seraph-room.glb', import.meta.url),
);
const metadata = {
  title: '200 MB 私密上传验证',
  description: '分段传输测试',
  visibility: 'private',
  compress: false,
};
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'kuro-200m-'));
  let writes = 0,
    stored = null;
  const storage = {
    async put(bytes) {
      writes++;
      stored = {
        length: bytes.length,
        hash: createHash('sha256').update(bytes).digest('hex'),
      };
      return 'test-r2-encrypted';
    },
    async get() {
      throw Error('unused');
    },
  };
  const handler = await createHouseHandler({
    dataDir: dir,
    password: 'chunk-test-only',
    secureCookies: false,
    modelOptions: { storage },
  });
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(origin + '/api/admin/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'chunk-test-only' }),
  });
  const { csrf } = await login.json(),
    cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { Origin: origin, Cookie: cookie, 'X-Studio-CSRF': csrf };
  /** @param {string} path @param {object} value @param {'POST'|'DELETE'} method */
  const json = (path, value = {}, method = 'POST') =>
    fetch(origin + path, {
      method: method === 'DELETE' ? 'DELETE' : 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  const start = (bytes) =>
    json('/api/admin/model-uploads', { bytes, metadata });
  const part = (id, index, bytes) =>
    fetch(`${origin}/api/admin/model-uploads/${id}/${index}`, {
      method: 'PUT',
      headers,
      body: bytes,
    });
  const status = (id) =>
    fetch(`${origin}/api/admin/model-uploads/${id}`, {
      headers: { Cookie: cookie },
    });
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    origin,
    headers,
    json,
    start,
    part,
    status,
    writes: () => writes,
    stored: () => stored,
  };
}
void test('upload sessions require admin and CSRF, reject oversize before accepting bytes', async (t) => {
  const f = await fixture(t);
  assert.equal(MAX_MODEL_BYTES, 200 * 1024 * 1024);
  assert.equal((await f.start(MAX_MODEL_BYTES + 1)).status, 413);
  const denied = await fetch(f.origin + '/api/admin/model-uploads', {
    method: 'POST',
    headers: { Origin: f.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bytes: tiny.length, metadata }),
  });
  assert.equal(denied.status, 401);
  const noCsrf = await fetch(f.origin + '/api/admin/model-uploads', {
    method: 'POST',
    headers: {
      Origin: f.origin,
      Cookie: f.headers.Cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bytes: tiny.length, metadata }),
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(f.writes(), 0);
});
void test('parts are idempotent, incomplete jobs cannot commit, and completion stores once', async (t) => {
  const f = await fixture(t),
    job = await (await f.start(tiny.length)).json(),
    path = '/api/admin/model-uploads/' + job.id;
  assert.equal((await f.json(path + '/complete')).status, 409);
  assert.equal((await f.part(job.id, 0, tiny)).status, 200);
  assert.equal((await f.part(job.id, 0, tiny)).status, 200);
  const changed = Buffer.from(tiny);
  changed[100] ^= 1;
  assert.equal((await f.part(job.id, 0, changed)).status, 409);
  assert.equal((await fetch(f.origin + path)).status, 401);
  assert.equal((await f.json(path + '/complete')).status, 202);
  await f.json(path + '/complete');
  let completed;
  for (let n = 0; n < 100; n++) {
    completed = await (await f.status(job.id)).json();
    if (completed.state === 'complete') break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(completed.state, 'complete');
  assert.equal(completed.item.visibility, 'private');
  assert.equal(completed.item.storage, 'r2');
  assert.equal(f.writes(), 1);
  assert.deepEqual(
    (await (await fetch(f.origin + '/api/models')).json()).items,
    [],
  );
});
void test('exactly 200 MiB uploads through twenty bounded requests, validates intact, and remains private', async (t) => {
  const f = await fixture(t),
    bytes = Buffer.alloc(MAX_MODEL_BYTES);
  tiny.copy(bytes);
  bytes.writeUInt32LE(bytes.length, 8);
  const binHeader = 20 + bytes.readUInt32LE(12);
  bytes.writeUInt32LE(bytes.length - binHeader - 8, binHeader);
  validateModelGlb(bytes);
  const job = await (await f.start(bytes.length)).json();
  assert(job.chunkBytes <= 10 * 1024 * 1024);
  // Reverse-order delivery proves assembly follows chunk indexes, not arrival order.
  for (
    let index = Math.ceil(bytes.length / job.chunkBytes) - 1;
    index >= 0;
    index--
  ) {
    const response = await f.part(
      job.id,
      index,
      bytes.subarray(index * job.chunkBytes, (index + 1) * job.chunkBytes),
    );
    assert.equal(response.status, 200);
  }
  assert.equal(
    (await f.json(`/api/admin/model-uploads/${job.id}/complete`)).status,
    202,
  );
  let complete;
  for (let n = 0; n < 200; n++) {
    complete = await (await f.status(job.id)).json();
    if (complete.state === 'complete') break;
    assert.notEqual(complete.state, 'failed', complete.error);
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(complete.state, 'complete');
  assert.equal(complete.item.originalBytes, MAX_MODEL_BYTES);
  assert.equal(
    f.stored().hash,
    createHash('sha256').update(bytes).digest('hex'),
  );
  assert.equal(f.writes(), 1);
  for (
    let n = 0;
    n < 30 && (await readdir(join(f.dir, 'model-upload-parts'))).length;
    n++
  )
    await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(await readdir(join(f.dir, 'model-upload-parts')), []);
});
