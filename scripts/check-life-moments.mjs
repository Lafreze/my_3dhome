import assert from 'node:assert/strict';
import { LifeEngine } from '../app/life-engine.ts';
import { residentRoutines, quietPoses } from '../app/life-routines.ts';
const moments = [],
  hooks = {
    collect() {},
    bubble() {},
    sound() {},
    coffee() {},
    moment: (...a) => moments.push(a),
  };
const input = {
  view: 'overview',
  environment: { time: 'sunset', weather: 'clear' },
  reduced: false,
  paused: false,
};
const make = () => {
  const e = new LifeEngine(323, hooks);
  for (const a of Object.values(e.actors)) a.stayUntil = Infinity;
  e.update(0.01, input);
  e.clock = 20;
  e.nextCheck = Infinity;
  return e;
};
for (const nodes of Object.values(residentRoutines))
  for (const id of nodes)
    assert(make().node(id).allowedActors.includes('resident'));
const e = make();
e.random.next = () => 0;
assert(e.quietMoment('study'));
assert.equal(e.events.active.kind, 'residentQuiet');
assert(
  quietPoses(e.actors.resident.node).includes(e.actors.resident.fsm.state),
);
assert(!e.quietMoment('cafe'));
const before = JSON.stringify(e.snapshot());
e.update(5, { ...input, paused: true });
assert.equal(JSON.stringify({ ...e.snapshot(), paused: false }), before);
const aroma = make();
aroma.actors.resident.visible = false;
aroma.random.next = () => 0;
assert(aroma.quietMoment('cafe'));
assert.equal(moments.at(-1)[0], 'coffeeAroma');
const dust = make();
dust.actors.resident.visible = false;
dust.random.next = () => 0;
assert(dust.quietMoment('gallery'));
assert.equal(moments.at(-1)[0], 'windowMotes');
for (const environment of [
  { time: 'night', weather: 'clear' },
  { time: 'sunset', weather: 'storm' },
]) {
  const no = make();
  no.environment = environment;
  no.actors.resident.visible = false;
  no.random.next = () => 0;
  assert(!no.quietMoment('gallery'));
}
const reduced = make();
reduced.reduced = true;
assert(!reduced.quietMoment('cafe'));
const warm = make();
warm.clock = 5;
assert(!warm.quietMoment('cafe'));
const modes = make();
const original = modes.residentRoutine;
modes.clock = 400;
modes.update(0.1, input);
assert.notEqual(modes.residentRoutine, original);
console.log(
  JSON.stringify({
    routines: 4,
    quietPoses: true,
    exclusiveEvents: true,
    weatherAndReducedMotion: true,
    paused: true,
  }),
);
