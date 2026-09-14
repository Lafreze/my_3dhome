import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {
  petalGeometry,
  trowelGeometry,
  botanicalSurface,
} from '../app/garden-surfaces.ts';

test('thin petals keep finite normals and UVs, with raised curled edges', () => {
  const g = petalGeometry();
  for (const name of ['position', 'normal', 'uv'])
    assert([...g.getAttribute(name).array].every(Number.isFinite));
  g.computeBoundingBox();
  assert(g.boundingBox.max.y > 0.2);
  assert(g.boundingBox.max.y < 0.4);
  assert(g.boundingBox.min.x >= -1 && g.boundingBox.max.x <= 1);
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++)
    assert(n.getY(i) > 0, 'upper petal surface must face the light');
  assert(g.getIndex().count / 3 <= 200);
  g.dispose();
});

test('garden trowel has a concave open blade above its table contact plane', () => {
  const g = trowelGeometry(),
    p = g.getAttribute('position');
  g.computeBoundingBox();
  assert(g.boundingBox.min.y >= 0);
  assert(g.boundingBox.max.x - g.boundingBox.min.x < 0.14);
  assert(g.boundingBox.max.z < -0.11 && g.boundingBox.min.z >= -0.38);
  let center = Infinity,
    rim = -Infinity;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getX(i)) < 0.001) center = Math.min(center, p.getY(i));
    if (Math.abs(p.getX(i)) > 0.05) rim = Math.max(rim, p.getY(i));
  }
  assert(rim - center > 0.02);
  for (const name of ['normal', 'uv'])
    assert([...g.getAttribute(name).array].every(Number.isFinite));
  g.dispose();
});

test('botanical maps preserve separate colour and relief data with bounded memory', () => {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {},
      }),
    }),
  };
  const textures = [];
  try {
    for (const kind of ['petal', 'leaf', 'soil']) {
      const maps = botanicalSurface(kind, textures);
      assert.equal(maps.map.colorSpace, T.SRGBColorSpace);
      assert.equal(maps.bumpMap.colorSpace, T.NoColorSpace);
      assert.equal(maps.roughnessMap.colorSpace, T.NoColorSpace);
      assert.notEqual(maps.map, maps.bumpMap);
      assert.equal(maps.map.image.width, 256);
    }
    assert.equal(new Set(textures).size, 9);
  } finally {
    textures.forEach((t) => t.dispose());
    globalThis.document = original;
  }
});
