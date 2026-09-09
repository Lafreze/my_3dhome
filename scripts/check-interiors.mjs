import assert from 'node:assert/strict';
import { Group, MeshStandardMaterial, Box3, Vector3 } from 'three';
import { pillowGeometry, drapedLinen } from '../app/bed-linen.ts';
import { addOakFloor } from '../app/house-finishes.ts';
import { curtainGeometry } from '../app/interior-atmosphere.ts';

const finiteGeometry = (geometry) => {
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = geometry.getAttribute(name);
    assert(attribute, `Missing ${name}`);
    assert([...attribute.array].every(Number.isFinite), `Non-finite ${name}`);
  }
  geometry.computeBoundingBox();
};
for (const [w, h, d] of [
  [1, 0.22, 1.12],
  [2.79, 0.32, 3.43],
  [0.93, 0.21, 0.69],
]) {
  const g = pillowGeometry(w, h, d);
  finiteGeometry(g);
  const p = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    assert(
      Math.abs(uv.getX(i) - (p.getX(i) / w + 0.5)) < 1e-6,
      'Woven texture must not converge into spherical rings',
    );
    assert(Math.abs(uv.getY(i) - (p.getZ(i) / d + 0.5)) < 1e-6);
  }
  g.dispose();
}
for (const [w, d, drop] of [
  [2.77, 2.29, 0.38],
  [2.8, 0.7, 0.4],
]) {
  const g = drapedLinen(w, d, drop);
  finiteGeometry(g);
  assert(g.boundingBox.min.y < -drop * 0.8, 'The hem must hang below the top');
  assert(
    g.boundingBox.max.y < 0.025,
    'Folds must stay below the resting avatar',
  );
  assert(
    g.boundingBox.max.x < w / 2 + 0.07,
    'Duvet must not expand into a walking route',
  );
  g.dispose();
}
const curtain = curtainGeometry();
finiteGeometry(curtain);
curtain.dispose();
const materials = Array.from({ length: 5 }, () => new MeshStandardMaterial());
for (const [w, d] of [
  [7.92, 6.67],
  [15.92, 7.92],
]) {
  const floor = new Group();
  addOakFloor(floor, w, d, materials);
  const bounds = new Box3().setFromObject(floor),
    size = bounds.getSize(new Vector3());
  assert(Math.abs(size.x - (w - 0.006)) < 0.001);
  assert(Math.abs(size.z - (d - 0.005)) < 0.001);
  assert(
    Math.abs(bounds.max.y - 0.0775) < 0.0001,
    'Every room needs the same floor height',
  );
  assert.equal(floor.children.length, 5, 'Board detail must stay batched');
  floor.children.forEach((mesh) => {
    finiteGeometry(mesh.geometry);
    mesh.geometry.dispose();
  });
}
materials.forEach((m) => m.dispose());
console.log(
  'Interiors: finite cloth geometry, planar pillow UVs, bounded duvet hems, consistent floor height and five batches per floor passed.',
);
