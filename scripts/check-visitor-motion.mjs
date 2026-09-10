import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Vector4, Matrix4 } from 'three';
import appearances from '../app/visitor-appearance.json' with { type: 'json' };
import {
  sampleVisitorMotion,
  visitorSeed,
  visitorWeights,
  motionRig,
} from '../app/visitor-motion.ts';

const seeds = Array.from({ length: 29 }, (_, i) => visitorSeed(`visitor-${i}`));
assert.equal(new Set(seeds).size, 29);
const signatures = new Set();
for (const seed of seeds) {
  let blinks = 0,
    wasClosed = false,
    maxYaw = 0,
    maxBreath = 0;
  const previous = new Vector4(),
    pose = new Vector4();
  for (let frame = 0; frame < 7200; frame++) {
    const t = frame / 60;
    sampleVisitorMotion(t, seed, false, pose);
    assert(pose.toArray().every(Number.isFinite));
    assert(pose.x >= 0 && pose.x <= 1);
    assert(
      Math.abs(pose.y) <= 0.155 &&
        Math.abs(pose.z) <= 0.0024 &&
        Math.abs(pose.w) <= 0.021,
    );
    if (frame) {
      assert(
        Math.abs(pose.y - previous.y) < 0.004,
        'Head must ease smoothly, including cycle boundaries',
      );
      assert(Math.abs(pose.z - previous.z) < 0.0001, 'No respiratory jumps');
    }
    if (pose.x > 0.95 && !wasClosed) blinks++;
    wasClosed = pose.x > 0.95;
    maxYaw = Math.max(maxYaw, Math.abs(pose.y));
    maxBreath = Math.max(maxBreath, Math.abs(pose.z));
    previous.copy(pose);
  }
  assert(blinks >= 12 && blinks <= 46, 'Natural blink rate over two minutes');
  assert(
    maxYaw > 0.08 && maxBreath > 0.002,
    'Both head and chest actually animate',
  );
  assert.deepEqual(
    sampleVisitorMotion(32, seed, true).toArray(),
    [0, 0, 0, 0],
    'Reduced motion is completely still',
  );
  const first = sampleVisitorMotion(23.8, seed, false).toArray();
  assert.deepEqual(
    first,
    sampleVisitorMotion(23.8, seed, false).toArray(),
    'Polling, appearance changes and reordering must not reset the pose',
  );
  signatures.add(first.join(','));
}
assert.equal(signatures.size, 29, 'Visitors must not move in lockstep');
const fits = [];
for (const { id: character } of appearances.characters) {
  const buffer = readFileSync(
    new URL(
      `../public/models/studio-visitor-${character}-v3.glb`,
      import.meta.url,
    ),
  );
  const length = buffer.readUInt32LE(12),
    gltf = JSON.parse(buffer.toString('utf8', 20, 20 + length));
  const points = [];
  for (const mesh of gltf.meshes)
    for (const primitive of mesh.primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION],
        view = gltf.bufferViews[accessor.bufferView];
      for (let i = 0; i < accessor.count; i++) {
        const o =
          28 +
          length +
          (view.byteOffset || 0) +
          (accessor.byteOffset || 0) +
          i * (view.byteStride || 12);
        points.push(
          new Vector3(
            buffer.readFloatLE(o),
            buffer.readFloatLE(o + 4),
            buffer.readFloatLE(o + 8),
          ),
        );
      }
    }
  const rig = motionRig[character],
    pivot = new Vector3(0, rig.neck, rig.neckZ);
  let widest = 0,
    contact = 0;
  for (const yaw of [-0.155, 0, 0.155])
    for (const pitch of [-0.021, 0.021]) {
      let min = Infinity,
        max = -Infinity;
      for (const p of points) {
        const [head, chest] = visitorWeights(character, p.x, p.y, p.z);
        const r = new Matrix4()
          .makeRotationY(yaw * head)
          .multiply(new Matrix4().makeRotationX(pitch * head));
        const moved = p.clone().sub(pivot).applyMatrix4(r).add(pivot);
        moved.y += 0.0024 * chest;
        min = Math.min(min, moved.x);
        max = Math.max(max, moved.x);
        if (p.y < 0.04) {
          assert.equal(head, 0);
          assert.equal(chest, 0);
          assert(
            moved.distanceTo(p) < 1e-12,
            'Cushion contact and feet remain fixed',
          );
          contact++;
        }
        if (character === 'fox' && p.z < -0.1)
          assert(
            moved.distanceTo(p) < 1e-12,
            'Rear tail fan stays attached to the hips',
          );
      }
      widest = Math.max(widest, max - min);
    }
  assert(
    widest < 0.637,
    'Turning head must still fit the narrowest adjacent seats',
  );
  assert(contact > 100);
  fits.push({ character, widest, contactChecks: contact });
}
console.log(
  JSON.stringify({ identities: 29, secondsPerIdentity: 120, seatFits: fits }),
);
