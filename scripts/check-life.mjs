import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  LifeEngine,
  AmbientEventScheduler,
  birdAllowed,
} from '../app/life-engine.ts';
import {
  NavigationGraph,
  OccupancyManager,
  floorClear,
  segmentClear,
  worldPoint,
  lifeObstacles,
} from '../app/life-navigation.ts';
import {
  navigationNodes,
  collectionCards,
  lifeStorageKey,
} from '../app/life-data.ts';
import {
  createCollectionStore,
  readCollections,
} from '../app/life-collections.ts';
const n = (id) => navigationNodes.find((n) => n.id === id),
  g = new NavigationGraph(),
  results = [];
assert.equal(
  new Set(navigationNodes.map((n) => n.id)).size,
  navigationNodes.length,
);
for (const actor of ['resident', 'rabbit', 'robot']) {
  const nodes = navigationNodes.filter((n) => n.allowedActors.includes(actor));
  for (const node of nodes)
    assert(floorClear(worldPoint(node), actor), `${actor}: ${node.id} blocked`);
  // Every pair has a safe route on its own actor graph, including all room transitions.
  for (const from of nodes)
    for (const to of nodes) {
      const path = g.path(worldPoint(from), worldPoint(to), actor);
      assert(path, `${actor}: ${from.id} -> ${to.id} unreachable`);
      let prev = worldPoint(from);
      for (const p of path) {
        assert(segmentClear(prev, p, actor));
        prev = p;
      }
    }
  results.push({ actor, nodes: nodes.length, pairs: nodes.length ** 2 });
}
assert(!floorClear(worldPoint(n('cafe.barInside')), 'robot'));
assert(!floorClear(worldPoint(n('bedroom.window')), 'robot'));
assert(
  !segmentClear([3, 0.085, 0], [5, 0.085, 0], 'resident'),
  'Cannot cross a solid partition',
);
assert(lifeObstacles.some((o) => o.id === 'crownedRabbit'));
const occupancy = new OccupancyManager();
occupancy.setVisitors([
  { id: 'online', seatId: 'study-work', position: [0.93, 0.77, -1.22] },
]);
assert(!occupancy.reserve(n('study.desk'), 'resident'));
assert(occupancy.reserve(n('gallery.bench'), 'resident'));
assert(!occupancy.reserve(n('gallery.bench'), 'cat'));
const scheduler = new AmbientEventScheduler();
assert(!scheduler.start('bird', 'bird', 9, 20, 150));
assert(scheduler.start('bird', 'bird', 11, 20, 150));
assert(!scheduler.start('coffee', 'resident', 12, 12, 35));
assert(!scheduler.start('rabbit', 'rabbit', 12, 4, 420));
assert(scheduler.start('greeting', 'resident', 13, 3, 8, true));
assert(!scheduler.start('greeting', 'resident', 14, 3, 8, true));
for (const weather of ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'])
  for (const time of ['morning', 'afternoon', 'sunset', 'night'])
    assert.equal(
      birdAllowed({ time, weather }),
      time !== 'night' && ['clear', 'cloudy'].includes(weather),
    );
assert(
  !birdAllowed({
    time: 'morning',
    weather: 'clear',
    solar: { altitude: -1, azimuth: 90 },
  }),
);
const calls = [],
  hooks = {
    collect: (...v) => calls.push(v),
    bubble: () => {},
    sound: () => {},
    coffee: () => {},
  };
const engine = new LifeEngine(42, hooks),
  input = {
    view: 'overview',
    environment: { time: 'sunset', weather: 'clear' },
    reduced: false,
    paused: false,
  };
for (let i = 0; i < 90; i++) engine.update(0.1, input);
assert.equal(engine.events.active, null);
const before = JSON.stringify(engine.snapshot()),
  beforeClock = engine.clock;
engine.update(20, { ...input, paused: true });
assert.equal(engine.clock, beforeClock, 'active clock freezes');
assert.equal(JSON.stringify({ ...engine.snapshot(), paused: false }), before);
engine.setVisitors([
  { id: 'online', seatId: 'study-work', position: [0.93, 0.77, -1.22] },
]);
assert.equal(engine.actors.resident.seated, false);
engine.update(0.1, input);
engine.interact('resident', [1, 8, 12]);
assert(calls.some((c) => c[0] === 'resident.firstGreeting'));
const count = calls.length;
engine.interact('resident', [1, 8, 12]);
assert.equal(calls.length, count);
const visited = new Set();
for (let i = 0; i < 18000; i++) {
  engine.update(0.1, input);
  visited.add(engine.actors.resident.room);
  for (const a of Object.values(engine.actors)) {
    if (!a.active || a.id === 'bird' || a.seated || a.fsm.state === 'ride')
      continue;
    assert(
      floorClear(a.position, a.id),
      `${a.id} left safe floor at ${a.position.join(',')}`,
    );
  }
  assert(Object.values(engine.actors).filter((a) => a.visible).length <= 3);
}
assert(
  visited.has('study') &&
    visited.has('living') &&
    visited.has('cafe') &&
    visited.has('gallery'),
  `Resident visited ${[...visited].join(',')}`,
);
const reducedEngine = new LifeEngine(9, hooks);
for (let i = 0; i < 600; i++)
  reducedEngine.update(0.1, { ...input, reduced: true });
assert.equal(reducedEngine.actors.bird.active, false);
assert.equal(reducedEngine.actors.resident.path.length, 0);
const birdEngine = new LifeEngine(99, hooks);
birdEngine.clock = 20;
assert(birdEngine.startBird('study'));
for (let i = 0; i < 450; i++)
  birdEngine.update(0.1, { ...input, view: 'study' });
assert(calls.some((c) => c[0] === 'visitor.bird.window'));
const missed = [];
const e = new LifeEngine(99, { ...hooks, collect: (...a) => missed.push(a) });
e.clock = 20;
e.startBird('study');
for (let i = 0; i < 450; i++)
  e.update(0.1, { ...input, view: i > 30 ? 'gallery' : 'study' });
assert(!missed.some((c) => c[0] === 'visitor.bird.window'));
// Force close, safe encounters so the rare combinations are covered without waiting for chance.
const meeting = new LifeEngine(8, hooks);
meeting.clock = 60;
meeting.nextCheck = 0;
meeting.random.next = () => 0.5;
for (const [id, x] of [
  ['cat', 1.5],
  ['rabbit', 2.2],
]) {
  const a = meeting.actors[id];
  Object.assign(a, {
    active: true,
    room: 'cafe',
    position: [x, 0.085, 17.65],
    stayUntil: 1000,
    expires: 1000,
  });
  assert(floorClear(a.position, id));
}
meeting.actors.robot.active = false;
meeting.update(0.1, { ...input, view: 'cafe' });
assert.equal(meeting.actors.cat.fsm.state, 'watchRabbit');
assert.equal(meeting.actors.rabbit.fsm.state, 'lookAround');
assert.equal(meeting.events.active.kind, 'animalMeeting');
assert(!meeting.startBird('cafe'), 'Bird cannot overlap the animal meeting');

const rideCards = [];
const ride = new LifeEngine(8, {
  ...hooks,
  collect: (...v) => rideCards.push(v),
});
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
ride.update(0.1, { ...input, view: 'cafe' });
assert.equal(ride.actors.cat.fsm.state, 'ride');
ride.nextCheck = 1000;
for (let i = 0; i < 230; i++) ride.update(0.1, { ...input, view: 'cafe' });
assert(rideCards.some((c) => c[0] === 'cat.robotRide'));
assert.equal(ride.actors.cat.fsm.state, 'sleep');
assert(
  floorClear(ride.actors.cat.position, 'cat'),
  'Cat dismounts onto clear floor',
);

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
};
const notices = [],
  store = createCollectionStore((...a) => notices.push(a));
assert(store.collect('visitor.rabbit.first', 'rabbit', 'gallery'));
assert(!store.collect('visitor.rabbit.first', 'rabbit', 'gallery'));
assert.equal(notices.length, 1);
assert(readCollections()['visitor.rabbit.first'].collectedAt);
memory.set(
  lifeStorageKey,
  JSON.stringify({
    version: 1,
    cards: {
      bad: {},
      'visitor.rabbit.cafe': { version: 99, collectedAt: 'bad' },
    },
  }),
);
assert.deepEqual(readCollections(), {});
await mkdir('output/playwright', { recursive: true });
await writeFile(
  'output/playwright/life-check.json',
  JSON.stringify(
    {
      navigation: results,
      residentRooms: [...visited],
      collectionCards: Object.keys(collectionCards).length,
      scheduler: 'exclusive / warmup / cooldown / user priority',
      safety: 'furniture + walls + visitors + robot exclusions',
      pause: 'active clock and reduced motion checked',
    },
    null,
    2,
  ),
);
console.log(
  'Life system checks passed:',
  JSON.stringify(results),
  'resident rooms:',
  [...visited],
);
