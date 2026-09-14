import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createHouseHandler } from './house-settings.mjs';
import { createModelLibrary, validateModelGlb } from './model-library.mjs';
import { createModelStorage } from './model-storage.mjs';
import { compressModel } from './model-compression.mjs';

const model = await readFile(
  new URL('../public/models/exhibits/seraph-room.glb', import.meta.url),
);
const memoryStorage = () => {
  const objects = new Map();
  return {
    objects,
    async remove(key) {
      objects.delete(key);
    },
    async put(bytes) {
      const key = randomBytes(32).toString('hex');
      objects.set(key, bytes);
      return key;
    },
    async get(key) {
      assert(objects.has(key));
      return objects.get(key);
    },
  };
};
async function fixture(t, storage = memoryStorage()) {
  const dir = await mkdtemp(join(tmpdir(), 'kuro-private-'));
  const options = {
    dataDir: dir,
    password: 'private-model-test',
    secureCookies: false,
    modelOptions: { storage },
  };
  let handler = await createHouseHandler(options);
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(origin + '/api/admin/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: options.password }),
  });
  const { csrf } = await login.json(),
    cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { Origin: origin, Cookie: cookie, 'X-Studio-CSRF': csrf };
  const upload = (metadata = {}, bytes = model) =>
    fetch(origin + '/api/models', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'model/gltf-binary',
        'X-Model-Metadata': encodeURIComponent(
          JSON.stringify({
            title: '私密机甲',
            description: '仅独立页面展示',
            visibility: 'private',
            compress: false,
            ...metadata,
          }),
        ),
      },
      body: bytes,
    });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    origin,
    headers,
    upload,
    storage,
    restart: async () => {
      handler = await createHouseHandler(options);
    },
  };
}
void test('private models never appear in public lists and require admin or an unguessable share capability', async (t) => {
  const f = await fixture(t),
    uploaded = await f.upload();
  assert.equal(uploaded.status, 201);
  const item = await uploaded.json();
  assert.match(item.sharePath, /^\/models\/private\/[A-Za-z0-9_-]{43}$/);
  assert.equal(item.storage, 'r2');
  assert(!('objectKey' in item));
  const code = item.sharePath.split('/').at(-1);
  for (const headers of [{}, f.headers]) {
    const response = await fetch(f.origin + '/api/models', { headers });
    const text = await response.text();
    assert.deepEqual(JSON.parse(text).items, []);
    assert(!text.includes(code));
    assert(!text.includes(item.title));
  }
  assert.equal((await fetch(f.origin + '/api/admin/models')).status, 401);
  const admin = await (
    await fetch(f.origin + '/api/admin/models', { headers: f.headers })
  ).json();
  assert.equal(admin.items[0].sharePath, item.sharePath);
  for (const method of ['GET', 'HEAD']) {
    assert.equal((await fetch(f.origin + item.url, { method })).status, 404);
    assert.equal(
      (await fetch(f.origin + item.url, { method, headers: f.headers })).status,
      200,
    );
  }
  const shared = await fetch(f.origin + '/api/model-share/' + code);
  assert.match(shared.headers.get('cache-control'), /no-store/);
  assert.match(shared.headers.get('x-robots-tag'), /noindex/);
  assert.equal(shared.headers.get('referrer-policy'), 'no-referrer');
  const data = await shared.json();
  assert.equal(data.item.title, item.title);
  assert(!data.items);
  assert(!data.item.objectKey);
  const file = await fetch(f.origin + data.item.url);
  assert.equal(file.headers.get('x-model-storage'), 'r2');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), model);
  const partial = await fetch(f.origin + data.item.url, {
    headers: { Range: 'bytes=0-19' },
  });
  assert.equal(partial.status, 206);
  assert.deepEqual(
    Buffer.from(await partial.arrayBuffer()),
    model.subarray(0, 20),
  );
  const invalid = 'a'.repeat(43);
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + invalid)).status,
    404,
  );
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + invalid + '/file.glb'))
      .status,
    404,
  );
  await f.restart();
  assert.equal((await fetch(f.origin + data.item.url)).status, 200);
  assert.equal(
    (await (await fetch(f.origin + '/api/models')).json()).items.length,
    0,
  );
  const saved = JSON.parse(
    await readFile(join(f.dir, 'model-library/catalog.json')),
  );
  assert.equal(saved.items[0].storage, 'r2');
  await assert.rejects(readFile(join(f.dir, `model-library/${item.id}.glb`)), {
    code: 'ENOENT',
  });
});
void test('replacing a private link needs admin/CSRF and immediately invalidates the old metadata and file routes', async (t) => {
  const f = await fixture(t),
    item = await (await f.upload()).json(),
    code = item.sharePath.split('/').at(-1);
  const url = f.origin + '/api/admin/models/reset-share';
  const request = {
    method: 'POST',
    headers: { ...f.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id }),
  };
  assert.equal(
    (
      await fetch(url, {
        ...request,
        headers: { Origin: f.origin, 'Content-Type': 'application/json' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(url, {
        ...request,
        headers: { ...request.headers, 'X-Studio-CSRF': '' },
      })
    ).status,
    403,
  );
  const replacement = await (await fetch(url, request)).json();
  assert.notEqual(item.sharePath, replacement.sharePath);
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + code)).status,
    404,
  );
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + code + '/file.glb')).status,
    404,
  );
  assert.equal(
    (
      await fetch(
        f.origin +
          '/api/model-share/' +
          replacement.sharePath.split('/').at(-1),
      )
    ).status,
    200,
  );
});
void test('public uploads stay visible and R2 failures do not publish catalog entries', async (t) => {
  const f = await fixture(t);
  const item = await (
    await f.upload({ visibility: 'public', title: '公开机甲' })
  ).json();
  assert(!item.sharePath);
  assert.equal(
    (await (await fetch(f.origin + '/api/models')).json()).items[0].id,
    item.id,
  );
  assert.equal((await fetch(f.origin + item.url)).status, 200);
  f.storage.put = async () => {
    throw Error('simulated outage');
  };
  assert.equal((await f.upload()).status, 503);
  assert.equal(
    (
      await (
        await fetch(f.origin + '/api/admin/models', { headers: f.headers })
      ).json()
    ).items.length,
    1,
  );
  assert.equal((await f.upload({ visibility: 'secret-invalid' })).status, 400);
});
void test('existing local files migrate to R2 without changing IDs or deleting originals', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'kuro-migration-')),
    id = 'f466cfab-a2ad-4e3b-9561-fb77bcb87481';
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'model-library'));
  await writeFile(join(dir, 'model-library', id + '.glb'), model);
  await writeFile(
    join(dir, 'model-library/catalog.json'),
    JSON.stringify({
      version: 1,
      items: [{ id, title: '已有模型', description: '', bytes: model.length }],
    }),
  );
  const storage = memoryStorage();
  const library = await createModelLibrary(dir, Date.now, { storage });
  assert.equal(library.list()[0].id, id);
  assert.equal(library.list(true)[0].storage, 'r2');
  assert.equal(storage.objects.size, 1);
  assert.deepEqual(
    await readFile(join(dir, 'model-library', id + '.glb')),
    model,
  );
  await createModelLibrary(dir, Date.now, { storage });
  assert.equal(storage.objects.size, 1);
});
void test('R2 uploaded bytes are encrypted, contain no share code or model metadata, and reject tampering', async () => {
  const objects = new Map();
  const client = {
    async send(command) {
      const input = command.input;
      if (input.Body) {
        objects.set(input.Key, Buffer.from(input.Body));
        return {};
      }
      return {
        Body: { transformToByteArray: async () => objects.get(input.Key) },
      };
    },
    destroy() {},
  };
  const env = {
    MODEL_STORAGE: 'r2',
    MODEL_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    R2_BUCKET_NAME: 'kuro-assets',
  };
  const storage = createModelStorage(env, { client });
  const key = await storage.put(model);
  const ciphertext = objects.get(key);
  assert.equal(ciphertext.toString('ascii', 0, 4), 'KMR1');
  assert.notDeepEqual(ciphertext.subarray(32), model);
  assert.deepEqual(await storage.get(key), model);
  ciphertext[50] ^= 1;
  await assert.rejects(storage.get(key));
  await assert.rejects(storage.get('kuro/manifests/assets.json'));
  assert.throws(() => createModelStorage({ MODEL_STORAGE: 'r2' }));
  assert.throws(() =>
    createModelStorage({ RAILWAY_ENVIRONMENT_ID: 'production' }),
  );
});
void test('small precompressed exhibits retain their exact geometry and textures', async () => {
  assert.deepEqual(await compressModel(model), model);
});
void test('compression reduces an uncompressed mesh without dropping triangles, materials, or animation', async () => {
  const { Document, NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { default: draco } = await import('draco3dgltf');
  const { SphereGeometry } = await import('three');
  const document = new Document(),
    buffer = document.createBuffer(),
    geometry = new SphereGeometry(1, 96, 64);
  const accessor = (type, array) =>
    document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive = document
    .createPrimitive()
    .setAttribute(
      'POSITION',
      accessor('VEC3', geometry.attributes.position.array),
    )
    .setAttribute('NORMAL', accessor('VEC3', geometry.attributes.normal.array))
    .setIndices(accessor('SCALAR', geometry.index.array))
    .setMaterial(
      document.createMaterial().setBaseColorFactor([0.2, 0.4, 0.8, 1]),
    );
  const node = document
    .createNode()
    .setMesh(document.createMesh().addPrimitive(primitive));
  document.createScene().addChild(node);
  const sampler = document
    .createAnimationSampler()
    .setInput(accessor('SCALAR', new Float32Array([0, 1])))
    .setOutput(accessor('VEC3', new Float32Array([0, 0, 0, 0, 1, 0])));
  document
    .createAnimation()
    .addSampler(sampler)
    .addChannel(
      document
        .createAnimationChannel()
        .setSampler(sampler)
        .setTargetNode(node)
        .setTargetPath('translation'),
    );
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco.createDecoderModule(),
    });
  const source = Buffer.from(await io.writeBinary(document)),
    result = await compressModel(source);
  assert(result.length < source.length * 0.6);
  assert.equal(
    validateModelGlb(result).triangles,
    validateModelGlb(source).triangles,
  );
  const restored = await io.readBinary(result);
  assert.equal(restored.getRoot().listMaterials().length, 1);
  assert.equal(restored.getRoot().listAnimations()[0].listChannels().length, 1);
  assert.deepEqual(
    restored.getRoot().listMaterials()[0].getBaseColorFactor(),
    [0.2, 0.4, 0.8, 1],
  );
  geometry.dispose();
});

void test('deletion requires admin, same-origin and CSRF; only uploaded models can be removed', async (t) => {
  const f = await fixture(t),
    item = await (await f.upload()).json();
  const url = f.origin + '/api/admin/models',
    request = {
      method: 'DELETE',
      headers: { ...f.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    };
  assert.equal(
    (
      await fetch(url, {
        ...request,
        headers: { Origin: f.origin, 'Content-Type': 'application/json' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(url, {
        ...request,
        headers: { ...request.headers, 'X-Studio-CSRF': 'invalid' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(url, {
        ...request,
        headers: { ...request.headers, Origin: 'https://other.test' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(url, { ...request, body: JSON.stringify({ id: 'seraph' }) }))
      .status,
    404,
  );
  assert.equal(f.storage.objects.size, 1);
  const removed = await fetch(url, request);
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), {
    id: item.id,
    deleted: true,
    cleanupPending: false,
  });
  assert.equal(f.storage.objects.size, 0);
  const code = item.sharePath.split('/').at(-1);
  for (const path of [
    item.url,
    '/api/model-share/' + code,
    '/api/model-share/' + code + '/file.glb',
  ])
    for (const method of ['GET', 'HEAD'])
      assert.equal(
        (await fetch(f.origin + path, { method, headers: f.headers })).status,
        404,
      );
  assert.equal(
    (
      await (
        await fetch(f.origin + '/api/admin/models', { headers: f.headers })
      ).json()
    ).items.length,
    0,
  );
  await f.restart();
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + code)).status,
    404,
  );
});

void test('local public model deletion removes the file and remains absent after restart', async (t) => {
  const f = await fixture(t, null),
    item = await (await f.upload({ visibility: 'public' })).json();
  const path = join(f.dir, `model-library/${item.id}.glb`);
  assert.deepEqual(await readFile(path), model);
  const r = await fetch(f.origin + '/api/admin/models', {
    method: 'DELETE',
    headers: { ...f.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id }),
  });
  assert.equal(r.status, 200);
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  await f.restart();
  assert.deepEqual(
    (await (await fetch(f.origin + '/api/models')).json()).items,
    [],
  );
  assert.equal((await fetch(f.origin + item.url)).status, 404);
});

void test('failed storage deletion cannot resurrect a private model and cleanup recovers after restart', async (t) => {
  const storage = memoryStorage();
  let unavailable = true;
  storage.remove = async (key) => {
    if (unavailable) throw Error('storage outage');
    storage.objects.delete(key);
  };
  const f = await fixture(t, storage),
    item = await (await f.upload()).json(),
    code = item.sharePath.split('/').at(-1);
  const result = await (
    await fetch(f.origin + '/api/admin/models', {
      method: 'DELETE',
      headers: { ...f.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
  ).json();
  assert.equal(result.cleanupPending, true);
  assert.equal(storage.objects.size, 1);
  await f.restart();
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + code)).status,
    404,
  );
  assert.equal(
    (await fetch(f.origin + '/api/model-share/' + code + '/file.glb')).status,
    404,
  );
  const saved = JSON.parse(
    await readFile(join(f.dir, 'model-library/catalog.json')),
  );
  assert(saved.items[0].deletedAt);
  unavailable = false;
  await f.restart();
  assert.equal(storage.objects.size, 0);
  assert.deepEqual(
    JSON.parse(await readFile(join(f.dir, 'model-library/catalog.json'))).items,
    [],
  );
});

void test('a model deleted during an in-flight object read is never sent to the reader', async (t) => {
  const storage = memoryStorage(),
    f = await fixture(t, storage),
    item = await (await f.upload()).json();
  let release, started;
  const reading = new Promise((resolve) => (started = resolve));
  storage.get = async (key) => {
    const bytes = storage.objects.get(key);
    started();
    await new Promise((resolve) => (release = resolve));
    return bytes;
  };
  const pending = fetch(
    f.origin +
      '/api/model-share/' +
      item.sharePath.split('/').at(-1) +
      '/file.glb',
  );
  await reading;
  const deleted = await fetch(f.origin + '/api/admin/models', {
    method: 'DELETE',
    headers: { ...f.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id }),
  });
  assert.equal(deleted.status, 200);
  release();
  const response = await pending;
  assert.equal(response.status, 404);
  assert(!(await response.text()).includes('glTF'));
});
