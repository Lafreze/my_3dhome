import assert from 'node:assert/strict';
import { RecordMechanism } from '../app/record-mechanism.ts';
import { LifeEngine } from '../app/life-engine.ts';
import { drapedLinen, turnedDuvetCorner } from '../app/bed-linen.ts';

const r = new RecordMechanism(0.05, -0.25);
for (let i = 0; i < 100; i++) r.update(0.016, true, false);
assert.equal(r.phase, 'cue');
assert(r.lift < 0);
for (let i = 0; i < 40; i++) r.update(0.016, true, false);
assert.equal(r.phase, 'playing');
assert.equal(r.lift, 0);
const outer = r.yaw;
for (let i = 0; i < 3000; i++) r.update(0.016, true, false);
assert(r.yaw < outer);
const playingYaw = r.yaw;
r.update(0.016, false, false);
assert.equal(r.phase, 'return');
assert.equal(r.yaw, playingYaw);
for (let i = 0; i < 35; i++) r.update(0.016, false, false);
assert(r.lift < -0.08);
assert.equal(r.yaw, playingYaw, 'Needle lifts before return traverse');
for (let i = 0; i < 100; i++) r.update(0.016, false, false);
assert.equal(r.phase, 'parked');
assert.equal(r.yaw, 0.72);
const angle = r.angle;
r.update(5, true, true);
assert.equal(r.angle, angle);
const interrupted = new RecordMechanism();
interrupted.update(0.1, true, false);
const cueLift = interrupted.lift;
interrupted.update(0.016, false, false);
assert(
  interrupted.lift <= cueLift,
  'Stopping during cue must not lower the needle',
);

for (const geometry of [
  drapedLinen(2.77, 2.29, 0.38, true),
  turnedDuvetCorner(),
]) {
  for (const a of Object.values(geometry.attributes))
    assert([...a.array].every(Number.isFinite));
  geometry.computeBoundingBox();
  assert(geometry.boundingBox.max.y < 0.08);
  geometry.dispose();
}
const e = new LifeEngine(31, {
  bubble() {},
  collect() {},
  sound() {},
  coffee() {},
  moment() {},
});
for (const a of Object.values(e.actors)) {
  a.active = false;
  a.stayUntil = Infinity;
}
const robot = e.actors.robot;
Object.assign(robot, {
  active: true,
  battery: 24,
  stayUntil: 0,
  node: 'cafe.aisle2',
  room: 'cafe',
  position: [3.05, 0.085, 15.65],
  path: [],
  target: null,
});
e.nextCheck = Infinity;
const input = {
  view: 'overview',
  environment: { time: 'sunset', weather: 'clear' },
  reduced: false,
  paused: false,
};
let arrived = false,
  lowest = 100;
for (let i = 0; i < 14000; i++) {
  e.update(0.05, input);
  if (robot.fsm.state === 'charging') {
    arrived = true;
    lowest = Math.min(lowest, robot.battery);
  }
  if (arrived && robot.path.length) {
    assert(robot.battery >= 89.9, 'Do not leave the dock half charged');
    break;
  }
}
assert(arrived);
assert(lowest < 25);
console.log(
  JSON.stringify({
    needleLiftBeforeReturn: true,
    inwardTracking: true,
    reduced: true,
    clothFinite: true,
    robotDocked: true,
    chargedBeforeDeparture: true,
  }),
);
