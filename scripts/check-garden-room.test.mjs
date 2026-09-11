import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rooms, roomAt } from '../app/house-data.ts';
import {
  gardenFurniture,
  gardenPortals,
  gardenRoutes,
} from '../app/garden-layout.ts';
import { createGardenState } from '../app/garden-state.ts';
import { floorClear, segmentClear } from '../app/life-navigation.ts';
import seats from '../app/seat-catalog.json' with { type: 'json' };
const world = ([x, z]) => [rooms.garden.x + x, 0.085, rooms.garden.z + z];
test('conservatory spans all three rooms with three traversable doorways and a continuous aisle', () => {
  const r = rooms.garden;
  assert.equal(
    r.depth,
    rooms.library.depth + rooms.gaming.depth + rooms.bar.depth,
  );
  assert(
    Math.abs(r.z - r.depth / 2 - (rooms.library.z - rooms.library.depth / 2)) <
      1e-8,
  );
  assert(
    Math.abs(r.z + r.depth / 2 - (rooms.bar.z + rooms.bar.depth / 2)) < 1e-8,
  );
  assert.equal(roomAt(r.x, r.z), 'garden');
  for (const p of gardenPortals) {
    assert.equal(p.at, rooms[p.a].x + rooms[p.a].width / 2);
    assert(Math.abs(p.at - (r.x - r.width / 2)) < 1e-8);
    for (let dx = -0.8; dx <= 0.8; dx += 0.04)
      assert(
        floorClear([p.at + dx, 0.085, p.along], 'resident'),
        `Blocked ${p.a} door at ${dx}`,
      );
  }
  for (const route of gardenRoutes)
    for (let i = 1; i < route.length; i++)
      assert(
        segmentClear(world(route[i - 1]), world(route[i]), 'resident'),
        `Blocked route ${JSON.stringify(route[i - 1])} to ${JSON.stringify(route[i])}`,
      );
});
test('furniture stays inside the conservatory and leaves distinct usable footprints', () => {
  const items = Object.entries(gardenFurniture).map(([id, f]) => {
    const c = Math.abs(Math.cos(f.yaw || 0)),
      s = Math.abs(Math.sin(f.yaw || 0));
    return [
      id,
      {
        ...f,
        width: c * f.width + s * f.depth,
        depth: c * f.depth + s * f.width,
      },
    ];
  });
  for (const [id, f] of items) {
    assert(Math.abs(f.x) + f.width / 2 <= 3.32, id);
    assert(Math.abs(f.z) + f.depth / 2 <= 11.82, id);
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const [id, a] = items[i],
        [other, b] = items[j];
      assert(
        Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
          Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2,
        JSON.stringify([id, other]),
      );
    }
  assert.equal(seats.filter((s) => s.room === 'garden').length, 7);
});
test('physical actions finish, ignore duplicate animation requests and support reduced motion', () => {
  const state = createGardenState(),
    advance = (n = 60) => {
      for (let i = 0; i < n; i++) state.update(0.1);
    };
  for (const id of ['gardenAlbum', 'gardenWorkbench', 'gardenLemonade']) {
    assert(state.interact(id));
    assert(!state.interact(id));
  }
  assert.equal(state.snapshot().filled, false);
  advance();
  assert.equal(state.snapshot().page, 1);
  assert.equal(state.snapshot().turning, 1);
  assert.equal(state.snapshot().watering, 1);
  assert.equal(state.snapshot().pouring, 1);
  assert(state.snapshot().filled);
  state.interact('gardenTerrarium');
  assert(state.snapshot().domeOpen);
  state.interact('gardenTerrarium');
  assert(!state.snapshot().domeOpen);
  state.interact('gardenAlbum');
  state.interact('gardenWorkbench');
  state.interact('gardenLemonade');
  state.update(0.01, true);
  assert.equal(state.snapshot().turning, 1);
  assert.equal(state.snapshot().watering, 1);
  assert(state.snapshot().filled);
  state.interact('gardenAlbum');
  advance();
  assert.equal(state.snapshot().page, 0);
  const before = state.snapshot();
  state.update(NaN);
  state.update(-100);
  assert.deepEqual(state.snapshot(), before);
  before.page = 99;
  assert.equal(state.snapshot().page, 0);
  assert(!state.interact('missing'));
});
