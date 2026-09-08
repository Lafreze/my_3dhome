import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import seats from '../app/seat-catalog.json' with { type: 'json' };
function load(character, version) {
  const buffer = readFileSync(
    new URL(
      `../public/models/studio-visitor-${character}-v${version}.glb`,
      import.meta.url,
    ),
  );
  const length = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + length));
  const start = 28 + length;
  function values(index) {
    const a = json.accessors[index],
      view = json.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126);
    const size = { VEC2: 2, VEC3: 3 }[a.type];
    assert(size);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: size }, (_, j) =>
        buffer.readFloatLE(
          start +
            (view.byteOffset || 0) +
            (a.byteOffset || 0) +
            i * (view.byteStride || size * 4) +
            j * 4,
        ),
      ),
    );
  }
  return { buffer, json, values };
}
const point = new Vector3();
for (const character of ['bear', 'cat', 'fox']) {
  const source = load(character, 3),
    model = load(character, 4);
  assert(
    model.buffer.length < 6_000_000,
    'Rest shapes must stay within the per-character web budget',
  );
  const basis = new Box3(),
    rest = new Box3();
  let triangles = 0;
  const sourceParts = source.json.meshes.flatMap((m) => m.primitives);
  for (const p of model.json.meshes.flatMap((m) => m.primitives)) {
    assert.equal(p.targets.length, 1);
    const material = model.json.materials[p.material].name;
    const old = sourceParts.find(
      (p) => source.json.materials[p.material].name === material,
    );
    assert(
      old,
      'Keep every original material and its independently editable colors',
    );
    const originals = source.values(old.attributes.POSITION);
    // Exporting a morph splits a few vertices at sharp normal seams; topology positions stay intact.
    const key = (v) => v.map((n) => n.toFixed(5)).join(',');
    const sourceVertices = new Set(originals.map(key));
    const positions = model.values(p.attributes.POSITION),
      delta = model.values(p.targets[0].POSITION);
    const normals = model.values(p.attributes.NORMAL),
      normalDelta = model.values(p.targets[0].NORMAL);
    assert.equal(
      model.values(p.attributes.TEXCOORD_0).length,
      positions.length,
    );
    assert.equal(delta.length, positions.length);
    assert.equal(normals.length, positions.length);
    triangles += model.json.accessors[p.indices].count / 3;
    for (let i = 0; i < positions.length; i++) {
      const v = positions[i];
      assert(
        sourceVertices.has(key(v)),
        `Approved seated body changed for ${character}`,
      );
      basis.expandByPoint(point.fromArray(v));
      const sleeping = v.map((n, axis) => n + delta[i][axis]);
      assert(sleeping.every(Number.isFinite));
      rest.expandByPoint(point.fromArray(sleeping));
      const normalLength = Math.hypot(
        ...normals[i].map((n, axis) => n + normalDelta[i][axis]),
      );
      assert(
        Number.isFinite(normalLength) &&
          normalLength > 0.98 &&
          normalLength < 1.02,
        'Resting surface normals must remain unit length',
      );
    }
  }
  assert(triangles > 80_000 && triangles < 110_000);
  assert(
    basis.max.x - basis.min.x < 0.61,
    'Sitting still fits the narrowest chair',
  );
  assert(
    rest.min.y >= 0.017 && rest.max.y < 0.65,
    'Resting body clears the mattress and stays lying down',
  );
  assert(
    rest.max.z - rest.min.z > 1.2,
    'Legs unfold into a full resting silhouette',
  );
  for (const bed of seats.filter((s) => s.kind === 'bed')) {
    assert(
      bed.offset[0] + rest.min.x > -1.395 && bed.offset[0] + rest.max.x < 1.395,
      'Body stays on its half of the bed',
    );
    assert(
      bed.offset[2] + rest.min.z > -1.715 && bed.offset[2] + rest.max.z < 1.715,
      'Head and feet stay on the mattress',
    );
  }
  console.log(
    `${character}: preserved seated shape, complete Rest morph/UV/normals, both bed slots fit, ${triangles} triangles, ${(model.buffer.length / 1e6).toFixed(2)} MB`,
  );
}
