import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  galleryPlinths,
  galleryCabinet,
  galleryTriptych,
} from '../app/gallery-layout.ts';
import { houseFurniture } from '../app/house-data.ts';
import {
  NavigationGraph,
  OccupancyManager,
  segmentClear,
  floorClear,
} from '../app/life-navigation.ts';
import { createHouseHandler } from './house-settings.mjs';
import { validateModelGlb } from './model-library.mjs';

const model = await readFile(
  new URL('../public/models/exhibits/seraph-room.glb', import.meta.url),
);
function changeJson(bytes, transform) {
  const size = bytes.readUInt32LE(12),
    json = JSON.parse(bytes.toString('utf8', 20, 20 + size));
  transform(json);
  const encoded = Buffer.from(JSON.stringify(json)),
    padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
  encoded.copy(padded);
  const binary = bytes.subarray(20 + size),
    header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, padded, binary]);
}
test('all six model derivatives are valid embedded GLBs with bounded density', async () => {
  for (const id of ['seraph', 'reaper', 'aureole'])
    for (const lod of ['room', 'detail']) {
      const bytes = await readFile(
        new URL(`../public/models/exhibits/${id}-${lod}.glb`, import.meta.url),
      );
      const stats = validateModelGlb(bytes);
      assert(stats.triangles <= (lod === 'room' ? 45001 : 160001));
      assert(bytes.length < 3 * 1024 * 1024);
    }
  const broken = Buffer.from(model);
  broken.writeUInt32LE(model.length + 20, 8);
  assert.throws(() => validateModelGlb(broken));
  assert.throws(() =>
    validateModelGlb(
      changeJson(
        model,
        (j) => (j.images[0].uri = 'https://example.test/private.png'),
      ),
    ),
  );
  assert.throws(() =>
    validateModelGlb(
      changeJson(model, (j) => (j.bufferViews[0].byteLength = 999999999)),
    ),
  );
});
test('plinths and cabinet fit the gallery with separated footprints and door-to-door circulation', () => {
  const furniture = Object.entries(houseFurniture.gallery);
  for (const [id, f] of furniture) {
    assert(Math.abs(f.x) + f.width / 2 < 3.95, id);
    assert(Math.abs(f.z) + f.depth / 2 < 3.3, id);
  }
  for (let i = 0; i < furniture.length; i++)
    for (let j = i + 1; j < furniture.length; j++) {
      const [a, f] = furniture[i],
        [b, g] = furniture[j];
      assert(
        Math.abs(f.x - g.x) > (f.width + g.width) / 2 + 0.12 ||
          Math.abs(f.z - g.z) > (f.depth + g.depth) / 2 + 0.12,
        `${a}/${b}`,
      );
    }
  assert(
    galleryPlinths[1].x -
      galleryPlinths[1].width / 2 -
      (galleryCabinet.x + galleryCabinet.width / 2) >
      0.8,
  );
  const graph = new NavigationGraph(),
    occupancy = new OccupancyManager();
  const points = [
    [5.6, 0.085, 4.1],
    [4.7, 0.085, 8.65],
    [9.6, 0.085, 9.5],
    [11.3, 0.085, 9.2],
    [5.18, 0.085, 6.55],
  ];
  for (const a of points) {
    assert(floorClear(a, 'resident'));
    for (const b of points) {
      const path = graph.path(a, b, 'resident', occupancy);
      assert(path, `${a.join(",")} to ${b.join(",")}`);
      let previous = a;
      for (const next of path) {
        assert(segmentClear(previous, next, 'resident'));
        previous = next;
      }
    }
  }
});
test('triptych has independent frames and three adjacent equal image regions', () => {
  const t = galleryTriptych;
  for (let i = 1; i < 3; i++)
    assert(t.centers[i] - t.centers[i - 1] - t.frameWidth > 0.14);
  assert(Math.abs((t.imageWidth * 3) / t.imageHeight - 1816 / 866) < 0.01);
});
test('model uploads require admin and CSRF, persist across restart, and are publicly readable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kuro-gallery-'));
  let handler = await createHouseHandler({
    dataDir: dir,
    password: 'test-gallery-pass',
    secureCookies: false,
  });
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const uploadHeaders = {
    'Content-Type': 'model/gltf-binary',
    Origin: origin,
    'X-Model-Metadata': encodeURIComponent(
      JSON.stringify({
        title: '测试藏品',
        description: '用于验证保存与恢复。',
      }),
    ),
  };
  try {
    assert.equal(
      (
        await fetch(origin + '/api/models', {
          method: 'POST',
          headers: uploadHeaders,
          body: model,
        })
      ).status,
      401,
    );
    const login = await fetch(origin + '/api/admin/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'test-gallery-pass' }),
    });
    const session = await login.json(),
      cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (
        await fetch(origin + '/api/models', {
          method: 'POST',
          headers: { ...uploadHeaders, Cookie: cookie },
          body: model,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + '/api/models', {
          method: 'POST',
          headers: {
            ...uploadHeaders,
            Origin: 'https://other.test',
            Cookie: cookie,
            'X-Studio-CSRF': session.csrf,
          },
          body: model,
        })
      ).status,
      403,
    );
    const response = await fetch(origin + '/api/models', {
      method: 'POST',
      headers: {
        ...uploadHeaders,
        Cookie: cookie,
        'X-Studio-CSRF': session.csrf,
      },
      body: model,
    });
    assert.equal(response.status, 201);
    const item = await response.json();
    assert.equal(item.title, '测试藏品');
    handler = await createHouseHandler({
      dataDir: dir,
      password: 'test-gallery-pass',
      secureCookies: false,
    });
    const library = await (await fetch(origin + '/api/models')).json();
    assert.equal(library.items.length, 1);
    assert.equal(library.items[0].id, item.id);
    const loaded = await fetch(origin + item.url);
    assert.equal(loaded.status, 200);
    assert.deepEqual(Buffer.from(await loaded.arrayBuffer()), model);
    assert.equal((await fetch(origin + '/api/models/unknown.glb')).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
