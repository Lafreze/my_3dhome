import { test } from 'node:test';
import assert from 'node:assert/strict';
import specs from '../config/character-rigs.json' with { type: 'json' };
import { sampleRigLeg, rigCycleDistance } from '../app/rig-gait.mjs';
for (const [id, s] of Object.entries(specs).filter(([, s]) => !s.animal)) {
  void test(`${id}: stance stays planted and no unreachable knee targets`, () => {
    const thigh = s.hip - s.knee,
      shin = s.knee - s.ankle;
    for (let i = 0; i <= 200; i++) {
      const distance = (i / 200) * rigCycleDistance,
        g = sampleRigLeg(distance, 1, 0, thigh, shin);
      assert.ok(Object.values(g).every(Number.isFinite));
      const y =
        -thigh * Math.cos(g.hip) -
        shin * Math.cos(g.hip + g.knee) +
        thigh +
        shin -
        g.drop;
      const z = -thigh * Math.sin(g.hip) - shin * Math.sin(g.hip + g.knee);
      assert.ok(
        Math.abs(z - g.z) < 0.00001,
        `${id} unreachable ankle at ${i}: ${z - g.z}`,
      );
      assert.ok(
        Math.abs(y - g.lift) < 0.00001,
        `${id} wrong contact at ${i}: ${y - g.lift}`,
      );
      if (g.phase < 0.6)
        assert.ok(
          Math.abs(g.z + distance - rigCycleDistance * 0.3) < 0.00001 ||
            i === 200,
        );
    }
  });
  void test(`${id}: foot trajectory has continuous lift-off and touchdown velocity`, () => {
    const h = 0.000001,
      L = s.hip - s.knee,
      l = s.knee - s.ankle;
    for (const boundary of [0.6, 1]) {
      const p = boundary * rigCycleDistance,
        a = sampleRigLeg(p - h, 1, 0, L, l),
        b = sampleRigLeg(p, 1, 0, L, l),
        c = sampleRigLeg(p + h, 1, 0, L, l);
      assert.ok(Math.abs((b.z - a.z) / h - (c.z - b.z) / h) < 0.001);
      assert.ok(
        Math.abs((b.lift - a.lift) / h - (c.lift - b.lift) / h) < 0.001,
      );
    }
  });
}
