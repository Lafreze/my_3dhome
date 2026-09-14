import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { advanceKettle } from '../app/cafe-craft.ts';

test('kettle spout clears the complete dripper envelope on lift, pour and interrupted return', () => {
  const spout = new T.CatmullRomCurve3([
    new T.Vector3(-0.17, 0.1, 0),
    new T.Vector3(-0.29, 0.12, 0),
    new T.Vector3(-0.33, 0.3, 0),
    new T.Vector3(-0.41, 0.4, 0),
  ]).getPoints(96);
  for (const blend of [0.025, 0.08, 0.3, 1])
    for (const interruption of [2, 8, 25, 160]) {
      let pose = { y: 0.056, angle: 0, stream: false };
      for (let frame = 0; frame < interruption + 600; frame++) {
        const pouring = frame < interruption;
        pose = advanceKettle(pose.y, pose.angle, pouring, blend);
        for (const point of spout) {
          const x =
              0.65 +
              point.x * Math.cos(pose.angle) -
              point.y * Math.sin(pose.angle),
            y =
              pose.y +
              point.x * Math.sin(pose.angle) +
              point.y * Math.cos(pose.angle);
          // Conservative cylinder contains the complete filter, lip and support ring.
          if (y > 0.393 - 0.016 && y < 0.655 + 0.016)
            assert(
              Math.hypot(x, 0.02) > 0.18 + 0.016,
              `spout hits filter at frame ${frame}`,
            );
        }
        if (pose.stream) assert(pouring && pose.y > 0.59);
      }
      assert(Math.abs(pose.y - 0.056) < 0.0001);
      assert(Math.abs(pose.angle) < 0.0001);
      assert.equal(pose.stream, false);
    }
});
