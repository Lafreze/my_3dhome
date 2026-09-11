import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rooms, roomAt } from '../app/house-data.ts';
import {
  barFurniture,
  barStools,
  barDartLane,
  barRoutes,
  barDoor,
} from '../app/bar-layout.ts';
import { floorClear, segmentClear } from '../app/life-navigation.ts';
import {
  createBarState,
  scoreDart,
  dartSectors,
  addDart,
  dartTotal,
  readDartBest,
} from '../app/bar-state.ts';
import seats from '../app/seat-catalog.json' with { type: 'json' };
const world = ([x, z]) => [rooms.bar.x + x, 0.085, rooms.bar.z + z];
test('B is an occupied café-aligned room with a passable corridor door', () => {
  assert.equal(rooms.bar.z, rooms.cafe.z);
  assert.equal(rooms.bar.depth, rooms.cafe.depth);
  assert.equal(roomAt(18.5, 14.2), 'bar');
  for (let dx = -0.8; dx <= 0.8; dx += 0.025)
    assert(floorClear([barDoor.at + dx, 0.085, barDoor.along], 'resident'));
  for (const route of barRoutes)
    for (let i = 1; i < route.length; i++)
      assert(
        segmentClear(world(route[i - 1]), world(route[i]), 'resident'),
        `Blocked route: ${JSON.stringify(route[i - 1])} -> ${JSON.stringify(route[i])}`,
      );
});
test('four high seats, four booth seats, and a furniture-free throwing lane', () => {
  assert.equal(barStools.length, 4);
  assert.equal(seats.filter((s) => s.room === 'bar').length, 8);
  for (const f of [...Object.values(barFurniture), ...barStools]) {
    assert(Math.abs(f.x) + f.width / 2 <= 4.41);
    assert(Math.abs(f.z) + f.depth / 2 <= 3.91);
    assert(
      Math.abs(f.x - barDartLane.x) >= (f.width + barDartLane.width) / 2 ||
        Math.abs(f.z - barDartLane.z) >= (f.depth + barDartLane.depth) / 2,
      'Furniture intrudes into throw lane',
    );
  }
});
test('mixing completes in order, rejects overlapping orders and preserves fridge/record', () => {
  const bar = createBarState();
  assert(bar.prepare('mint'));
  assert.equal(bar.prepare('berry'), false);
  bar.fridge();
  bar.record(2);
  const phases = new Set();
  for (let i = 0; i < 80; i++) {
    bar.update(0.1);
    phases.add(bar.snapshot().phase);
  }
  assert.deepEqual([...phases], ['ice', 'pour', 'shake', 'garnish', 'ready']);
  assert.equal(bar.snapshot().drink, 'mint');
  assert.equal(bar.snapshot().fridgeOpen, true);
  assert.equal(bar.snapshot().record, 2);
  const copy = bar.snapshot();
  copy.fridgeOpen = false;
  assert.equal(bar.snapshot().fridgeOpen, true);
  assert(bar.prepare('berry'));
  bar.clear();
  assert.equal(bar.snapshot().phase, 'idle');
  bar.record(99);
  assert.equal(bar.snapshot().record, null);
});
test('dart scoring agrees with all 20 drawn sectors and both multiplier rings', () => {
  assert.equal(scoreDart(0, 0).score, 50);
  assert.equal(scoreDart(0.08, 0).score, 25);
  assert.equal(scoreDart(1.01, 0).score, 0);
  assert.equal(scoreDart(NaN, 0).score, 0);
  dartSectors.forEach((value, i) => {
    const a = (i * Math.PI) / 10;
    for (const [r, m] of [
      [0.35, 1],
      [0.58, 3],
      [0.96, 2],
    ])
      assert.equal(
        scoreDart(Math.sin(a) * r, -Math.cos(a) * r).score,
        value * m,
      );
  });
  let hits = [];
  for (let i = 0; i < 12; i++) hits = addDart(hits, 0, -0.58);
  assert.equal(hits.length, 9);
  assert.equal(dartTotal(hits), 540);
  assert.equal(readDartBest(), 0);
});
