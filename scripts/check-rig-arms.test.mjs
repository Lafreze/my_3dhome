import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { poseArm } from '../app/rig-arm.ts';
import specs from '../config/character-rigs.json' with { type: 'json' };
for (const [id, s] of Object.entries(specs))
  if (!s.animal)
    test(`${id}: arms reach continuously without stretching or reversing elbows`, () => {
      for (const side of ['L', 'R']) {
        const sign = side === 'L' ? -1 : 1;
        const points = ['upperArm', 'forearm', 'hand'].map(
          (n) => new T.Vector3(...s.joints.find((j) => j[0] === n + side)[2]),
        );
        const upper = new T.Bone(),
          lower = new T.Bone(),
          hand = new T.Bone();
        upper.add(lower);
        lower.add(hand);
        lower.position.copy(points[1]).sub(points[0]);
        hand.position.copy(points[2]).sub(points[1]);
        const lengths = [lower.position.length(), hand.position.length()];
        let previous;
        for (let i = 0; i <= 100; i++) {
          const target = new T.Vector3(
            sign * 0.035,
            -(lengths[0] + lengths[1]) * 0.94,
            0.085,
          ).lerp(
            new T.Vector3(sign * 0.16, s.hip + 0.24, 0.27).sub(points[0]),
            i / 100,
          );
          poseArm(
            upper,
            lower,
            hand,
            target,
            new T.Vector3(sign * 0.25, -0.12, -0.03),
          );
          upper.updateMatrixWorld(true);
          const e = lower.getWorldPosition(new T.Vector3()),
            h = hand.getWorldPosition(new T.Vector3());
          assert.ok(Math.abs(e.length() - lengths[0]) < 1e-6);
          assert.ok(Math.abs(e.distanceTo(h) - lengths[1]) < 1e-6);
          assert.ok(
            h.distanceTo(target) < 0.02,
            'hand misses reachable target',
          );
          if (previous)
            assert.ok(
              h.distanceTo(previous) < 0.01,
              'hand snaps between poses',
            );
          previous = h;
          assert.ok(
            [...upper.quaternion, ...lower.quaternion].every(Number.isFinite),
          );
        }
      }
    });
