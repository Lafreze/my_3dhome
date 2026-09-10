import assert from 'node:assert/strict';
import { LifeEngine } from '../app/life-engine.ts';
import { worldPoint, floorClear, distance } from '../app/life-navigation.ts';
import { actorSpecs } from '../app/life-data.ts';
import { sampleRabbitHop, rabbitHopDuration } from '../app/rabbit-motion.ts';
import { loadLifeSession, rememberLifeStarts } from '../app/life-session.ts';
const hooks = { collect() {}, bubble() {}, sound() {}, coffee() {} };
const variants = Object.fromEntries(
  Object.keys(actorSpecs).map((id) => [id, new Set()]),
);
let previous = {};
for (let seed = 1; seed <= 150; seed++) {
  const e = new LifeEngine(seed * 2654435761, hooks, previous);
  const actors = Object.values(e.actors);
  for (const a of actors) {
    const n = e.node(a.node);
    assert(n.allowedActors.includes(a.id));
    if (a.id !== 'bird') assert(floorClear(a.position, a.id));
    assert.notEqual(
      a.node,
      previous[a.id],
      `${a.id} repeated previous arrival`,
    );
    assert(a.stayUntil >= 10, 'Quiet arrival');
    assert(!a.path.length);
    variants[a.id].add(a.node);
    if (a.active)
      for (const b of actors)
        if (b.active && a.id !== b.id)
          assert(
            distance(a.position, b.position) >=
              actorSpecs[a.id].radius + actorSpecs[b.id].radius + 0.05,
          );
  }
  previous = Object.fromEntries(actors.map((a) => [a.id, a.node]));
}
for (const [id, nodes] of Object.entries(variants))
  assert(nodes.size >= 4, `${id} has varied safe starts`);
for (let seed = 1; seed <= 50; seed++) {
  const guarded = new LifeEngine(seed, hooks, {}, [
    { id: 'online', seatId: 'study-work', position: [0.93, 0.77, -1.22] },
  ]);
  assert.notEqual(
    guarded.node(guarded.actors.resident.node).seatId,
    'study-work',
  );
  for (const a of Object.values(guarded.actors))
    if (a.active)
      assert(
        distance(a.position, [0.93, 0.77, -1.22]) >=
          actorSpecs[a.id].radius + 0.34,
      );
}
assert.deepEqual(
  new LifeEngine(734329, hooks).snapshot(),
  new LifeEngine(734329, hooks).snapshot(),
  'Seed replays the same start',
);
for (let t = 0; t < rabbitHopDuration * 4; t += 0.001) {
  const a = sampleRabbitHop(t),
    b = sampleRabbitHop(t + 0.001);
  assert(a.height >= 0 && a.height <= 0.11001);
  assert(b.distance >= a.distance, 'Forward hop');
  if (a.height < 1e-8 && b.height < 1e-8)
    assert(
      Math.abs(b.distance - a.distance) < 1e-10,
      'Planted feet never slide',
    );
}
const e = new LifeEngine(84, hooks);
e.clock = 30;
e.nextCheck = Infinity;
e.rabbitEligible = false;
for (const a of Object.values(e.actors)) a.stayUntil = Infinity;
const a = e.actors.rabbit,
  from = e.node('cafe.aisle1'),
  to = e.node('cafe.aisle2');
Object.assign(a, {
  active: true,
  node: from.id,
  room: from.room,
  position: worldPoint(from),
  expires: 1000,
});
e.occupancy.release('rabbit');
assert(e.go(a, to));
let moved = false,
  groundedHolds = 0;
const input = {
  view: 'overview',
  environment: { time: 'sunset', weather: 'clear' },
  reduced: false,
  paused: false,
};
for (let i = 0; i < 2000 && a.path.length; i++) {
  const p = [...a.position],
    h = sampleRabbitHop(a.hopTime);
  e.update(0.025, input);
  assert(floorClear(a.position, 'rabbit'));
  if (distance(p, a.position) > 0) moved = true;
  if (h.height < 1e-8 && sampleRabbitHop(a.hopTime).height < 1e-8) {
    assert(distance(p, a.position) < 1e-10);
    groundedHolds++;
  }
}
assert(moved && groundedHolds > 10);
assert.equal(a.path.length, 0);
const frozen = e.snapshot();
e.update(5, { ...input, paused: true });
assert.deepEqual({ ...e.snapshot(), paused: false }, frozen);
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
};
rememberLifeStarts(previous);
const realFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  assert.equal(options.cache, 'no-store');
  return {
    ok: true,
    json: async () => ({ version: 1, seed: 1234, serverTime: 1789000000000 }),
  };
};
const session = await loadLifeSession();
assert.equal(session.seed, 1234);
assert.equal(session.source, 'server');
assert.deepEqual(session.previous, previous);
globalThis.fetch = async () => {
  throw Error('Offline');
};
assert.equal((await loadLifeSession()).source, 'local');
globalThis.fetch = realFetch;
console.log(
  JSON.stringify({
    arrivals: 150,
    nodes: Object.fromEntries(
      Object.entries(variants).map(([id, v]) => [id, v.size]),
    ),
    groundedHolds,
    serverSeed: 'validated',
    offlineFallback: true,
  }),
);
