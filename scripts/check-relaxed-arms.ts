import { NodeIO } from '@gltf-transform/core';
import * as T from 'three';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { prepareVisitorLimbs } from '../app/visitor-motion.ts';
import { prepareStandingMorph } from '../app/visitor-pose-morph.ts';
import { refineVisitorSeated } from '../app/visitor-seat-fit.ts';
import {
  visitorSeatedArmWeight,
  relaxedVisitorArm,
} from '../app/visitor-arm-pose.ts';
import type { VisitorPart } from '../app/visitor-model.ts';
import type { Character } from '../app/visitor-appearance.ts';
const io = new NodeIO();
for (const kind of [
  'bear',
  'cat',
  'fox',
  'noir',
  'rose',
  'ivory',
  'dusk',
  'ribbon',
] as Character[]) {
  const sit = await io.read(`public/models/studio-visitor-${kind}-v3.glb`);
  const stand = await io.read(
    `public/models/studio-visitor-${kind}-standing-v5.glb`,
  );
  const parts: VisitorPart[] = [];
  for (const [doc, pose] of [
    [sit, 'sit'],
    [stand, 'rest'],
  ] as const) {
    for (const primitive of doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())) {
      const g = new T.BufferGeometry();
      for (const [key, name] of [
        ['POSITION', 'position'],
        ['NORMAL', 'normal'],
        ['TEXCOORD_0', 'uv'],
      ]) {
        const a = primitive.getAttribute(key)!;
        g.setAttribute(
          name,
          new T.BufferAttribute(
            new Float32Array(a.getArray()!),
            a.getElementSize(),
          ),
        );
      }
      g.setIndex(Array.from(primitive.getIndices()!.getArray()!));
      parts.push({
        character: kind,
        pose,
        geometry: g,
        name: kind,
        material: new T.MeshStandardMaterial(),
        matrix: new T.Matrix4(),
      });
    }
  }
  await prepareStandingMorph(parts);
  const sitting = parts.filter((p) => p.pose === 'sit');
  const before = sitting.map((p) =>
    p.geometry.getAttribute('position').array.slice(),
  );
  const originalStand = sitting.map((p) =>
    p.geometry.getAttribute('visitorStandPosition').array.slice(),
  );
  refineVisitorSeated(parts);
  let relaxed = 0,
    hangingHair = 0,
    displacement = 0,
    spikes = 0;
  const point = new T.Vector3();
  for (const [j, p] of sitting.entries()) {
    const g = p.geometry,
      a = g.getAttribute('position'),
      st = g.getAttribute('visitorStandPosition');
    prepareVisitorLimbs(g, kind);
    const limbs = g.getAttribute('visitorWeights');
    assert.deepEqual(
      st.array,
      originalStand[j],
      'Standing/rest surface must not change',
    );
    for (let i = 0; i < a.count; i++) {
      assert([a.getX(i), a.getY(i), a.getZ(i)].every(Number.isFinite));
      const weight = visitorSeatedArmWeight(
        kind,
        st.getX(i),
        st.getY(i),
        st.getZ(i),
      );
      assert(limbs.getZ(i) >= 0 && limbs.getZ(i) <= 1);
      if (kind === 'ribbon') {
        // Sample the actual twin-tail tips beside the sleeves, below the head.
        const height = st.getY(i) / 0.7291830564122577 + 0.43813141642026954;
        const side = Math.abs(st.getX(i) / 0.7291830564122577);
        if (height > 0.67 && height < 0.8 && side > 0.32) {
          assert(
            limbs.getW(i) < 0.001,
            'Twin tails must not inherit arm swing',
          );
          assert(
            Math.abs(a.getY(i) - before[j][i * 3 + 1]) < 1e-6,
            'Relaxing the sleeves must not pull the hanging hair',
          );
          hangingHair++;
        }
      }
      if (weight > 1 - 1e-6) {
        assert(
          limbs.getZ(i) < 0.001,
          'Hands and held accessories must not inherit leg strides',
        );
        relaxedVisitorArm(kind, st.getX(i), st.getY(i), st.getZ(i), point);
        assert(
          Math.hypot(
            a.getX(i) - point.x,
            a.getY(i) - point.y,
            a.getZ(i) - point.z - (kind === 'fox' ? 0.06 : 0.025),
          ) < 0.0003,
        );
        relaxed++;
      }
      displacement = Math.max(
        displacement,
        Math.hypot(
          a.getX(i) - before[j][i * 3],
          a.getY(i) - before[j][i * 3 + 1],
          a.getZ(i) - before[j][i * 3 + 2],
        ),
      );
      if (st.getY(i) > 0.46)
        assert(
          Math.abs(a.getY(i) - before[j][i * 3 + 1]) < 1e-5,
          'Face and hair must stay unchanged',
        );
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3)
      for (let k = 0; k < 3; k++) {
        const x = ix.getX(i + k),
          y = ix.getX(i + ((k + 1) % 3));
        const length = Math.hypot(
          a.getX(x) - a.getX(y),
          a.getY(x) - a.getY(y),
          a.getZ(x) - a.getZ(y),
        );
        const previous = Math.hypot(
          before[j][x * 3] - before[j][y * 3],
          before[j][x * 3 + 1] - before[j][y * 3 + 1],
          before[j][x * 3 + 2] - before[j][y * 3 + 2],
        );
        if (length > Math.max(0.09, previous * 6)) {
          spikes++;
          if (process.argv.includes('--debug'))
            console.log(
              JSON.stringify({
                kind,
                part: j,
                length,
                previous,
                points: [x, y].map((v) => ({
                  before: Array.from(before[j].slice(v * 3, v * 3 + 3)),
                  stand: [st.getX(v), st.getY(v), st.getZ(v)],
                  after: [a.getX(v), a.getY(v), a.getZ(v)],
                  weight: visitorSeatedArmWeight(
                    kind,
                    st.getX(v),
                    st.getY(v),
                    st.getZ(v),
                  ),
                })),
              }),
            );
        }
      }
  }
  assert(relaxed > 50, 'Each visitor needs a relaxed hand/sleeve region');
  if (kind === 'ribbon')
    assert(hangingHair > 50, 'Twin-tail checks cover the actual sculpt');
  assert.equal(spikes, 0, `${kind}: arms must remain a connected surface`);
  console.log({ kind, relaxed, displacement, spikes });
  if (process.argv.includes('--export')) {
    await mkdir('output/pose-bedroom-review', { recursive: true });
    const doc = kind === 'fox' ? stand : sit;
    const primitives = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives());
    sitting.forEach((p, i) => {
      primitives[i]
        .getAttribute('POSITION')!
        .setArray(new Float32Array(p.geometry.getAttribute('position').array));
      primitives[i]
        .getAttribute('NORMAL')!
        .setArray(new Float32Array(p.geometry.getAttribute('normal').array));
    });
    await io.write(`output/pose-bedroom-review/relaxed-${kind}.glb`, doc);
  }
  parts.forEach((p) => {
    p.geometry.dispose();
    (p.material as T.Material).dispose();
  });
}
