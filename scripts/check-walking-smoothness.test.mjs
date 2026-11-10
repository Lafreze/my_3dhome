import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundWalkingPath,
  walkingProgress,
  walkingPathPoint,
  walkingPathLength,
} from '../app/walking-path.mjs';
import {
  sampleResidentGait,
  residentCycleDistance,
} from '../app/resident-gait.ts';
import {
  createVisitorJourney,
  sampleVisitorJourney,
  walkingCycleDistance,
} from '../app/visitor-travel.mjs';

void test('rounded routes keep endpoints and reject corners that clip a solid obstacle', () => {
  const route = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
  ];
  const rounded = roundWalkingPath(route, () => true);
  assert(rounded.length > route.length);
  assert.deepEqual(rounded[0], route[0]);
  assert.deepEqual(rounded.at(-1), route.at(-1));
  assert(walkingPathLength(rounded) < 2);
  const blocked = roundWalkingPath(
    route,
    (a, b) => (a[2] === 0 && b[2] === 0) || (a[0] === 1 && b[0] === 1),
  );
  assert.deepEqual(blocked, route);
});

void test('distance-based timing starts and ends at rest and is identical at 30, 60 and 144 Hz', () => {
  for (const duration of [0.1, 0.5, 5, 30]) {
    const length = duration * 0.96;
    assert.equal(walkingProgress(0, duration, length).speed, 0);
    assert.equal(walkingProgress(duration, duration, length).speed, 0);
    assert.equal(walkingProgress(duration, duration, length).distance, length);
    for (const fps of [30, 60, 144]) {
      let previous = 0;
      for (let i = 1; i <= Math.ceil(duration * fps); i++) {
        const p = walkingProgress(i / fps, duration, length);
        assert(p.distance >= previous && p.distance <= length);
        assert(p.distance - previous <= 1.281 / fps);
        previous = p.distance;
      }
      assert.equal(previous, length);
    }
  }
});

void test('resident ankles stay planted during stance and lift only on recovery, with level soles', () => {
  for (const amount of [0, 0.1, 0.5, 1])
    for (let i = 0; i < 1000; i++)
      for (const side of [0, 1]) {
        const g = sampleResidentGait(
          (i / 1000) * residentCycleDistance,
          amount,
          side,
        );
        const y =
          0.47 -
          g.drop -
          0.22 * Math.cos(g.hip) -
          0.16 * Math.cos(g.hip + g.knee);
        const z = -0.22 * Math.sin(g.hip) - 0.16 * Math.sin(g.hip + g.knee);
        assert(Math.abs(y - (0.09 + g.lift)) < 1e-8);
        assert(Math.abs(z - g.z) < 1e-8);
        assert(Math.abs(g.hip + g.knee + g.ankle) < 1e-12);
        if (g.phase <= 0.6) assert.equal(g.lift, 0);
      }
});

void test('visitor exit, walking and entry gait measure actual displacement without phase resets', () => {
  const j = createVisitorJourney('study-work', 'cafe-chair-1', 'sit', 'sit', 0);
  let previous, last;
  for (
    let ms = j.rise * 1000;
    ms < (j.rise + j.exit + j.walk + j.enter) * 1000;
    ms += 8
  ) {
    const s = sampleVisitorJourney(j, ms);
    assert(s.walkAmount >= 0 && s.walkAmount <= 1);
    if (previous) {
      const travelled = Math.hypot(
        s.position[0] - previous.position[0],
        s.position[2] - previous.position[2],
      );
      const gaitDistance =
        ((s.gait - previous.gait) / Math.PI / 2) * walkingCycleDistance;
      assert(gaitDistance >= -1e-8);
      assert(Math.abs(gaitDistance - travelled) < 0.003);
    }
    previous = s;
    last = s;
  }
  assert(last.gait > 0);
  assert.deepEqual(walkingPathPoint(j.path, Infinity), j.path.at(-1));
});

void test('small physical steps can cross a valid door-edge route without being trapped by planning padding', async () => {
  const { walkingStepClear, floorClear, OccupancyManager } =
    await import('../app/life-navigation.ts');
  const from = [3.5561233283292806, 0.085, 1.4263232032285442],
    to = [4.06, 0.085, 1.54];
  let previous = from;
  for (let i = 1; i <= 80; i++) {
    const p = from.map((v, n) => v + ((to[n] - v) * i) / 80);
    assert(walkingStepClear(previous, p, 'resident'));
    assert(floorClear(p, 'resident'));
    previous = p;
  }
  const occupancy = new OccupancyManager();
  occupancy.actors.set('cat', {
    position: [0, 0.085, 0],
    radius: 0.2,
    active: true,
  });
  assert(
    occupancy.clearMovement(
      [0.5, 0.085, 0],
      [0.51, 0.085, 0],
      'resident',
      0.015,
    ),
  );
  assert(
    !occupancy.clearMovement(
      [0.5, 0.085, 0],
      [0.49, 0.085, 0],
      'resident',
      0.015,
    ),
  );
  assert(
    !occupancy.clearMovement(
      [0.7, 0.085, 0],
      [0.4, 0.085, 0],
      'resident',
      0.015,
    ),
  );
});
