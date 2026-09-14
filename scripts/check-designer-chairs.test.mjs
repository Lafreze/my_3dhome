import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  chairSources,
  designerChairs,
  chairPlacement,
  loungeHeight,
} from '../app/designer-chair-layout.ts';
import { seatById } from '../app/seat-data.ts';
import { assetUrl, assetManifest } from '../app/asset-url.ts';

globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, init) {
    super(type);
    Object.assign(this, init);
  }
};

async function geometryModel(name) {
  const bytes = await readFile(`public/models/chairs/${name}.glb`);
  const jsonLength = bytes.readUInt32LE(12),
    json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  assert(
    json.images.length >= 3,
    'Authored colour, normal and roughness maps remain embedded',
  );
  assert(
    json.images.every((image) => image.bufferView !== undefined && !image.uri),
  );
  const bin = bytes.subarray(28 + jsonLength);
  json.buffers = [
    {
      byteLength: bin.length,
      uri: `data:application/octet-stream;base64,${bin.toString('base64')}`,
    },
  ];
  delete json.images;
  delete json.textures;
  json.materials = [{ doubleSided: true }];
  for (const mesh of json.meshes)
    for (const p of mesh.primitives) p.material = 0;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}

void test('14 chairs align their actual cushion surfaces with unchanged seat anchors and fit room clearances', async () => {
  assert.equal(designerChairs.length, 14);
  for (const chair of designerChairs) {
    const model = await geometryModel(chair.model),
      fit = chairPlacement(chair),
      seat = seatById.get(chair.seat);
    model.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.getAttribute('position');
      if (chair.model === 'mid-century-lounge')
        for (let i = 0; i < p.count; i++)
          p.setY(i, loungeHeight(chair, p.getY(i)).y);
      assert([...p.array].every(Number.isFinite));
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundingSphere();
    });
    model.scale.set(...fit.scale);
    model.rotation.y = fit.yaw;
    model.position.set(...fit.position);
    model.updateMatrixWorld(true);
    const from = new T.Vector3(...seat.offset);
    from.y += 0.15;
    const ray = new T.Raycaster(from, new T.Vector3(0, -1, 0));
    const hit = ray.intersectObject(model, true)[0];
    assert(hit, `${chair.seat}: missing seat cushion`);
    assert(
      Math.abs(hit.point.y - seat.offset[1]) < 0.006,
      `${chair.seat}: seat error ${hit.point.y - seat.offset[1]}`,
    );
    const box = new T.Box3().setFromObject(model),
      size = box.getSize(new T.Vector3());
    assert(
      box.min.y >= 0.084 && box.min.y < 0.09,
      `${chair.seat}: feet on floor`,
    );
    assert(
      box.max.y < 1.82,
      `${chair.seat}: proportional back height ${box.max.y}`,
    );
    assert(
      size.x <= chair.width + 0.002 && size.z <= chair.depth + 0.002,
      `${chair.seat}: footprint`,
    );
    // Actual model extents, including asymmetric recliner backs, stay inside reserved circulation space.
    const depthLimit = chair.seat.startsWith('cafe-chair-')
      ? chair.model === 'tufted-dining'
        ? 0.47
        : 0.73
      : chair.model === 'tufted-dining'
        ? 0.48
        : 0.73;
    assert(
      Math.max(Math.abs(box.min.z), Math.abs(box.max.z)) <= depthLimit,
      `${chair.seat}: circulation depth ${box.min.z} / ${box.max.z}`,
    );
    model.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
});

void test('CC0 furniture is bundled on the app origin, versioned and below the download budget', () => {
  let total = 0;
  for (const name of Object.keys(chairSources)) {
    const id = `furniture.chair.${name}`,
      entry = assetManifest.assets[id];
    assert.match(
      assetUrl(id, 'https://assets.kuro.cafe/kuro'),
      /^\/assets\/models\/furniture\/.+\.[a-f0-9]{16}\.glb$/,
    );
    assert.equal(entry.dependencies.length, 0);
    total += entry.size;
  }
  assert(total < 3.2 * 1024 * 1024);
});
