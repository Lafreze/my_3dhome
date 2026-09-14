import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {
  refinedTabletop,
  neutralFurnitureFinish,
} from '../app/furniture-suite.ts';

void test('refined table edges preserve contact height, footprint and finite normals', () => {
  const suite = Object.fromEntries(
    ['timber', 'edge', 'stone', 'metal'].map((n) => [
      n,
      new T.MeshPhysicalMaterial(),
    ]),
  );
  suite.timber.userData.surface = suite.edge.userData.surface = 'ash';
  for (const [w, d, y, round] of [
    [2.75, 1.1, 1.27, false],
    [1.15, 1.15, 1.22, false],
    [1.44, 1.44, 0.725, true],
    [0.72, 0.75, 0.7365, false],
    [1.6, 1.6, 0.96, true],
  ]) {
    const g = new T.Group();
    refinedTabletop(g, w, d, y, suite, round);
    g.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(g);
    assert(
      Math.abs(b.max.y - y) < 1e-6,
      'tabletop props must not float or sink',
    );
    assert(Math.abs(b.max.x - b.min.x - w) < 1e-5);
    assert(b.max.z - b.min.z <= d + 1e-5);
    g.traverse((o) => {
      if (!o.isMesh) return;
      for (const name of ['position', 'normal', 'uv'])
        assert([...o.geometry.getAttribute(name).array].every(Number.isFinite));
      o.geometry.dispose();
    });
  }
  Object.values(suite).forEach((m) => m.dispose());
});
void test('white refinishing retains authored texture sampling and distinct shader programs', () => {
  const materials = ['timber', 'upholstery'].map((role) => {
    const m = new T.MeshStandardMaterial();
    neutralFurnitureFinish(m, role);
    const shader = {
      fragmentShader:
        '#include <map_fragment>\n#include <roughnessmap_fragment>',
    };
    m.onBeforeCompile(shader, {});
    assert(shader.fragmentShader.includes('texture2D( map, vMapUv )'));
    assert(shader.fragmentShader.includes('roughnessFactor = max'));
    return m;
  });
  assert.notEqual(
    materials[0].customProgramCacheKey(),
    materials[1].customProgramCacheKey(),
  );
  materials.forEach((m) => m.dispose());
});
