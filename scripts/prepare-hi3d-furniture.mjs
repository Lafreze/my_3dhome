// Optimize the approved Hi3D originals without overwriting them.
// Usage: node scripts/prepare-hi3d-furniture.mjs [asset-id ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  weld,
  simplify,
  draco,
  textureCompress,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await Promise.all([MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
  });
const plan = JSON.parse(
  await readFile('config/hi3d-furniture.json', 'utf8'),
).assets;
const selected = process.argv.slice(2);
const entries = plan.filter((a) => !selected.length || selected.includes(a.id));
await mkdir('public/models/hi3d-furniture', { recursive: true });
const catalog = JSON.parse(await readFile('config/asset-catalog.json', 'utf8'));
const count = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .reduce(
      (sum, m) =>
        sum +
        m
          .listPrimitives()
          .reduce(
            (n, p) =>
              n +
              (p.getIndices()?.getCount() ??
                p.getAttribute('POSITION').getCount()) /
                3,
            0,
          ),
      0,
    );
for (const a of entries) {
  const raw = await readFile(`output/hi3d-upgrade/${a.id}/source.glb`);
  const doc = await io.readBinary(raw);
  const before = count(doc),
    budget = a.version === 'v3.0' ? 55000 : 22000;
  await doc.transform(
    dedup(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, budget / before),
      error: 0.0008,
    }),
    prune(),
  );
  // Preserve the authored PBR channels; use 1K for room-scale presentation.
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [1024, 1024],
      slots: /baseColorTexture|emissiveTexture/,
      quality: 88,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [1024, 1024],
      slots: /normalTexture|metallicRoughnessTexture|occlusionTexture/,
      lossless: true,
    }),
    draco({ quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }),
  );
  const bytes = await io.writeBinary(doc),
    source = `public/models/hi3d-furniture/${a.id}.glb`;
  await writeFile(source, bytes);
  const record = {
    id: `furniture.hi3d.${a.id}`,
    name: a.name,
    source,
    path: `models/hi3d-furniture/${a.id}.glb`,
    type: 'model',
    room: a.room,
    rooms: [a.room],
    license: 'Hi3D private generation; owner-authorized use in this project',
    author: 'SATORI / Hi3D',
    sourceUrl: a.modelPage,
    modifications:
      'Original design reference; mesh simplification with bounded error, 1K PBR textures, Draco compression, fitted to original furniture footprint at runtime',
    approval: 'approved',
    delivery: 'origin',
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const index = catalog.assets.findIndex((e) => e.id === record.id);
  if (index >= 0) catalog.assets[index] = record;
  else catalog.assets.push(record);
  const report = {
    id: a.id,
    version: a.version,
    taskId: a.taskId,
    modelPage: a.modelPage,
    sourceBytes: raw.length,
    bytes: bytes.length,
    sourceTriangles: before,
    triangles: count(doc),
    sourceSha256: createHash('sha256').update(raw).digest('hex'),
    sha256: record.sourceSha256,
  };
  await writeFile(
    `output/hi3d-upgrade/${a.id}/production.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
}
await writeFile(
  'config/asset-catalog.json',
  JSON.stringify(catalog, null, 2) + '\n',
);
