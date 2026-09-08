import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Vector3, Quaternion, Box3 } from 'three';
import seats from '../app/seat-catalog.json' with { type: 'json' };
import appearances from '../app/visitor-appearance.json' with { type: 'json' };
const results = [];
for (const { id: character } of appearances.characters) {
  const buffer = readFileSync(
    new URL(
      `../public/models/studio-visitor-${character}-v3.glb`,
      import.meta.url,
    ),
  );
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
  const binStart = 28 + jsonLength;
  const full = new Box3(),
    feet = new Box3();
  let triangles = 0,
    contact = 0;
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    assert(
      !/^(Head|Calf|Foot|Gender_|Hair_)/.test(node.name || ''),
      'Original body must not use the old detached joint parts',
    );
    const local = node.matrix
      ? new Matrix4().fromArray(node.matrix)
      : new Matrix4().compose(
          new Vector3().fromArray(node.translation || [0, 0, 0]),
          new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
          new Vector3().fromArray(node.scale || [1, 1, 1]),
        );
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined)
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const positions = gltf.accessors[primitive.attributes.POSITION];
        const view = gltf.bufferViews[positions.bufferView];
        assert.equal(positions.componentType, 5126);
        assert.equal(
          gltf.accessors[primitive.attributes.TEXCOORD_0].count,
          positions.count,
          'Original UVs must accompany every vertex',
        );
        assert.equal(
          gltf.accessors[primitive.attributes.NORMAL].count,
          positions.count,
          'Complete smooth surface normals',
        );
        triangles += gltf.accessors[primitive.indices].count / 3;
        for (let i = 0; i < positions.count; i++) {
          const start =
            binStart +
            (view.byteOffset || 0) +
            (positions.byteOffset || 0) +
            i * (view.byteStride || 12);
          const point = new Vector3(
            buffer.readFloatLE(start),
            buffer.readFloatLE(start + 4),
            buffer.readFloatLE(start + 8),
          ).applyMatrix4(world);
          assert(
            point.toArray().every(Number.isFinite),
            'Non-finite deformed vertex',
          );
          full.expandByPoint(point);
          if (character === 'fox' && point.y < -0.03)
            assert(
              point.z > 0.15,
              'Folded tails and rear hem must stay above the cushion',
            );
          if (point.z > 0.34 && point.y < 0.06) feet.expandByPoint(point);
          if (
            Math.abs(point.y) < 0.025 &&
            point.z < 0.16 &&
            point.z > -0.14 &&
            Math.abs(point.x) < 0.2
          )
            contact++;
        }
      }
    for (const child of node.children || []) visit(child, world);
  }
  for (const root of gltf.scenes[gltf.scene || 0].nodes) visit(root);
  assert(buffer.length < 5_000_000, 'Local web asset size budget');
  assert(
    triangles > 80_000 && triangles < 110_000,
    'Detailed silhouette within rendering budget',
  );
  assert(
    full.max.x - full.min.x < 0.61,
    'Fits the narrowest adjacent banquette spacing',
  );
  assert(contact > 20, 'A continuous seat contact patch is required');
  assert(
    !feet.isEmpty() && feet.max.z > (character === 'fox' ? 0.4 : 0.45),
    'Boots extend forward as in the sitting reference',
  );
  for (const seat of seats)
    assert(
      seat.offset[1] + full.min.y > 0.08,
      `Model penetrates floor at ${seat.id}`,
    );
  for (const name of [
    'Original',
    'TintHair',
    'TintEyes',
    'TintTop',
    'TintBottom',
  ])
    assert(
      gltf.materials.some(
        (material) =>
          material.name.replace(/\.\d+$/, '') === `${character}_${name}`,
      ),
      `Missing ${character} ${name}`,
    );
  results.push({
    character,
    bytes: buffer.length,
    triangles,
    seatFits: seats.length,
    contactVertices: contact,
    bounds: [full.min.toArray(), full.max.toArray()],
  });
}
console.log(JSON.stringify(results));
