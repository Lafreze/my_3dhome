import assert from 'node:assert/strict';
import {
  sampleCatPaw,
  catScale,
  catStride,
  catRiseTime,
} from '../app/cat-gait.ts';
import { LifeEngine } from '../app/life-engine.ts';
import { distance, floorClear } from '../app/life-navigation.ts';

// Each planted paw stays in the same world position as the body moves forward.
// Every paw must lift during its own swing, with at least two paws supporting the cat.
const lifted = new Set();
let plantedSamples = 0;
for (let d = 0; d < catStride * 3; d += 0.001) {
  const paws = [0, 1, 2, 3].map((i) => sampleCatPaw(d, i));
  assert(paws.filter((p) => p.grounded).length >= 2);
  paws.forEach((p, i) => {
    assert(p.y >= 0 && p.y <= 0.12);
    if (p.y > 0.05) lifted.add(i);
    const next = sampleCatPaw(d + 0.001, i);
    if (p.grounded && next.grounded) {
      const worldZ = -d + p.z * catScale;
      const nextWorldZ = -(d + 0.001) + next.z * catScale;
      assert(
        Math.abs(worldZ - nextWorldZ) < 1e-10,
        'Planted paw must not skate',
      );
      plantedSamples++;
    }
  });
}
assert.equal(lifted.size, 4);
const hooks = { collect() {}, bubble() {}, sound() {}, coffee() {} };
const input = {
  view: 'study',
  environment: { time: 'sunset', weather: 'clear' },
  reduced: false,
  paused: false,
};
const e = new LifeEngine(12, hooks);
e.clock = 20;
e.nextCheck = Infinity;
e.rabbitEligible = false;
for (const a of Object.values(e.actors))
  if (a.id !== 'cat') {
    a.active = false;
    a.stayUntil = Infinity;
  }
const cat = e.actors.cat;
cat.rotation = Math.PI;
const initial = [...cat.position];
assert(e.go(cat, e.node('study.aisle')));
for (let t = 0; t < catRiseTime - 0.1; t += 0.05) e.update(0.05, input);
assert.deepEqual(cat.position, initial, 'Get up before translating');
assert.equal(cat.travelDistance, 0);
let turned = false,
  walked = false,
  steps = 0;
while (cat.path.length && steps++ < 3000) {
  const prev = [...cat.position],
    rotation = cat.rotation;
  e.update(0.025, input);
  const traveled = distance(prev, cat.position);
  const angle = Math.abs(
    Math.atan2(
      Math.sin(cat.rotation - rotation),
      Math.cos(cat.rotation - rotation),
    ),
  );
  assert(angle <= 2.4 * 0.025 + 1e-8, 'No instant direction flip');
  if (cat.fsm.state === 'turn') {
    assert.equal(traveled, 0);
    turned = true;
  }
  if (traveled > 0.00001) {
    walked = true;
    const heading = Math.atan2(
      -(cat.position[0] - prev[0]),
      -(cat.position[2] - prev[2]),
    );
    assert(
      Math.abs(
        Math.atan2(
          Math.sin(heading - cat.rotation),
          Math.cos(heading - cat.rotation),
        ),
      ) <=
        0.04 + 1e-6,
      'Walk forwards, not sideways',
    );
  }
  assert(floorClear(cat.position, 'cat'));
}
assert(turned && walked);
assert.equal(cat.path.length, 0);
assert.equal(cat.fsm.state, 'settle');
const stopped = [...cat.position],
  gait = cat.travelDistance;
for (let i = 0; i < 20; i++) e.update(0.05, input);
assert.deepEqual(cat.position, stopped);
assert.equal(cat.travelDistance, gait, 'No walking cycle while stopped');
const snapshot = JSON.stringify(e.snapshot());
e.update(5, { ...input, paused: true });
assert.equal(JSON.stringify({ ...e.snapshot(), paused: false }), snapshot);

// Occupied routes hold the cat in place, and reduced motion never starts a journey.
const blocked = new LifeEngine(14, hooks);
blocked.clock = 20;
blocked.nextCheck = Infinity;
const b = blocked.actors.cat;
assert(blocked.go(b, blocked.node('study.aisle')));
blocked.setVisitors([{ id: 'nearby', seatId: '', position: [...b.position] }]);
const blockedStart = [...b.position];
for (let i = 0; i < 40; i++) blocked.update(0.05, input);
assert.deepEqual(b.position, blockedStart);
assert.equal(b.travelDistance, 0);
const reduced = new LifeEngine(8, hooks);
reduced.update(0.05, { ...input, reduced: true });
assert.equal(
  reduced.go(reduced.actors.cat, reduced.node('study.aisle')),
  false,
);
// Boarding and dismounting have a visible arc; a click cannot strand the cat in air.
const ride = new LifeEngine(8, hooks);
ride.clock = 60;
ride.nextCheck = 0;
ride.random.next = () => 0;
Object.assign(ride.actors.cat, {
  room: 'cafe',
  position: [2.15, 0.085, 17.65],
  stayUntil: 1000,
});
Object.assign(ride.actors.robot, {
  path: [[1.5, 0.085, 17.2]],
  stayUntil: 1000,
});
const cafeInput = { ...input, view: 'cafe' };
ride.update(0.05, cafeInput);
assert.equal(ride.actors.cat.fsm.state, 'ride');
ride.nextCheck = Infinity;
const robotStart = [...ride.actors.robot.position];
let highest = 0;
for (let i = 0; i < 16; i++) {
  ride.update(0.05, cafeInput);
  highest = Math.max(highest, ride.actors.cat.position[1]);
  assert.deepEqual(
    ride.actors.robot.position,
    robotStart,
    'Robot waits while the cat boards',
  );
}
assert(highest > 0.35, 'Hop rises above the robot, not a floor-level slide');
ride.interact('cat', [3, 8, 19]);
assert.equal(ride.actors.cat.fsm.state, 'ride');
for (let i = 0; i < 320; i++) ride.update(0.05, cafeInput);
assert(Math.abs(ride.actors.cat.position[1] - 0.085) < 1e-10);
assert(floorClear(ride.actors.cat.position, 'cat'));
assert.notEqual(ride.actors.cat.fsm.state, 'ride');

console.log(
  JSON.stringify({
    plantedSamples,
    liftedPaws: lifted.size,
    riseBeforeWalk: true,
    turnBeforeTranslation: true,
    arrival: 'settle',
    occupiedRoute: 'holds',
    pause: 'frozen',
  }),
);
