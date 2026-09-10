import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BufferGeometry, Float32BufferAttribute, Box3, Vector3 } from 'three';
import { visitorRestMatrix, prepareRestGeometry } from '../app/visitor-rest.ts';
import { humanScale } from '../app/character-scale.mjs';
import seats from '../app/seat-catalog.json' with { type: 'json' };
import poses from '../app/visitor-rest-poses.json' with { type: 'json' };
import appearances from '../app/visitor-appearance.json' with { type: 'json' };
const point = new Vector3(),
  other = new Vector3();
for (const { id: character } of appearances.characters) {
  const data = readFileSync(
    new URL(
      `../public/models/studio-visitor-${character}-standing-v5.glb`,
      import.meta.url,
    ),
  );
  const length = data.readUInt32LE(12),
    json = JSON.parse(data.toString('utf8', 20, 20 + length));
  const start = 28 + length;
  function attribute(index) {
    const a = json.accessors[index],
      v = json.bufferViews[a.bufferView];
    const size = { VEC2: 2, VEC3: 3 }[a.type];
    assert.equal(a.componentType, 5126);
    const result = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++)
      for (let j = 0; j < size; j++)
        result[i * size + j] = data.readFloatLE(
          start +
            (v.byteOffset || 0) +
            (a.byteOffset || 0) +
            i * (v.byteStride || size * 4) +
            j * 4,
        );
    return new Float32BufferAttribute(result, size);
  }
  const imageHashes = (buffer) => {
    const n = buffer.readUInt32LE(12),
      j = JSON.parse(buffer.toString('utf8', 20, 20 + n));
    return j.images
      .map((image) => {
        const view = j.bufferViews[image.bufferView];
        return createHash('sha256')
          .update(
            buffer.subarray(
              28 + n + (view.byteOffset || 0),
              28 + n + (view.byteOffset || 0) + view.byteLength,
            ),
          )
          .digest('hex');
      })
      .sort();
  };
  const seatedFile = readFileSync(
    new URL(
      `../public/models/studio-visitor-${character}-v3.glb`,
      import.meta.url,
    ),
  );
  assert.deepEqual(
    imageHashes(data),
    imageHashes(seatedFile),
    'Texture sharing requires byte-identical artwork and normal maps',
  );
  assert(
    data.length < 4_500_000,
    'Detailed standing asset fits the web budget',
  );
  assert(
    !json.animations && !json.skins,
    'Rest must not use an inverse seated rig',
  );
  assert(
    json.nodes.every(
      (n) =>
        !n.extras ||
        !('standingEdgeError' in n.extras) ||
        n.extras.standingEdgeError < 1e-6,
    ),
  );
  const standing = new Box3(),
    resting = new Box3();
  let triangles = 0;
  for (const primitive of json.meshes.flatMap((m) => m.primitives)) {
    assert(
      !primitive.targets,
      'No reconstructed Rest morphs: render the intact standing body',
    );
    const geometry = new BufferGeometry();
    const positions = attribute(primitive.attributes.POSITION),
      normals = attribute(primitive.attributes.NORMAL);
    assert.equal(
      attribute(primitive.attributes.TEXCOORD_0).count,
      positions.count,
    );
    assert.equal(normals.count, positions.count);
    geometry.setAttribute('position', positions);
    geometry.setAttribute('normal', normals);
    const blink = new Float32Array(positions.count * 3);
    blink[2] = -0.016;
    geometry.setAttribute(
      'visitorBlinkDelta',
      new Float32BufferAttribute(blink, 3),
    );
    prepareRestGeometry(geometry, character);
    const rest = geometry.getAttribute('visitorRestPosition'),
      normal = geometry.getAttribute('visitorRestNormal');
    const matrix = visitorRestMatrix(character);
    triangles += json.accessors[primitive.indices].count / 3;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      standing.expandByPoint(point);
      other.fromBufferAttribute(rest, i);
      resting.expandByPoint(other);
      assert(other.toArray().every(Number.isFinite));
      assert(
        point.applyMatrix4(matrix).distanceTo(other) < 1e-6,
        'Every body point must follow exactly the same rigid transform',
      );
      point.fromBufferAttribute(normal, i);
      assert(Math.abs(point.length() - 1) < 1e-5);
      if (i) {
        const d1 = point
          .fromBufferAttribute(positions, i)
          .distanceTo(other.fromBufferAttribute(positions, i - 1));
        const d2 = point
          .fromBufferAttribute(rest, i)
          .distanceTo(other.fromBufferAttribute(rest, i - 1));
        assert(
          Math.abs(d2 - d1 * poses[character].scale) < 1e-6,
          'Neck, clothes and tail connections cannot stretch',
        );
      }
    }
    // A closed eye follows exactly the same frame as the original face.
    point
      .fromBufferAttribute(positions, 0)
      .add(new Vector3(0, 0, -0.016))
      .applyMatrix4(matrix);
    other
      .fromBufferAttribute(rest, 0)
      .add(
        new Vector3().fromBufferAttribute(
          geometry.getAttribute('visitorRestBlinkDelta'),
          0,
        ),
      );
    assert(point.distanceTo(other) < 1e-6);
    geometry.dispose();
  }
  assert(
    triangles > (['noir', 'rose'].includes(character) ? 47_000 : 95_000) &&
      triangles < 110_000,
  );
  assert(
    resting.min.y >= 0.009 && resting.max.y < 0.8,
    'Body clears mattress and remains lying down',
  );
  assert(
    standing.max.y - standing.min.y > 1.1,
    'Keep the original complete standing body',
  );
  if (character === 'fox')
    assert(
      standing.max.x - standing.min.x > 1,
      'Original nine tails stay full-width',
    );
  resting.min.multiplyScalar(humanScale(character));
  resting.max.multiplyScalar(humanScale(character));
  for (const bed of seats.filter((s) => s.kind === 'bed')) {
    assert(
      bed.offset[0] + resting.min.x > -1.395 &&
        bed.offset[0] + resting.max.x < 1.395,
      'Both full figures fit their bed halves',
    );
    assert(
      bed.offset[2] + resting.min.z > -1.715 &&
        bed.offset[2] + resting.max.z < 1.715,
    );
  }
  console.log(
    `${character}: original standing body, rigid rest, complete UV/normals, aligned closed eyes, both beds fit; ${triangles} triangles`,
  );
}
