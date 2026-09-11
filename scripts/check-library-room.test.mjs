import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rooms, roomAt } from '../app/house-data.ts';
import {
  libraryFurniture,
  libraryDoor,
  libraryRoutes,
  libraryLadderLane,
  libraryLadderStops,
} from '../app/library-layout.ts';
import {
  createLibraryState,
  libraryBooks,
  readLibraryBookmarks,
} from '../app/library-state.ts';
import { floorClear, segmentClear } from '../app/life-navigation.ts';
import seats from '../app/seat-catalog.json' with { type: 'json' };

const world = ([x, z]) => [rooms.library.x + x, 0.085, rooms.library.z + z];
const separate = (a, b) =>
  Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
  Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2;

test('square library meets the extended corridor, keeps the game room boundary, and has an exterior north window', () => {
  const r = rooms.library,
    hall = rooms.corridor;
  assert.equal(r.width, r.depth);
  assert.equal(r.z + r.depth / 2, rooms.gaming.z - rooms.gaming.depth / 2);
  assert(Math.abs(r.z - r.depth / 2 - (hall.z - hall.depth / 2)) < 1e-8);
  assert.equal(roomAt(r.x, r.z), 'library');
  assert.equal(roomAt(17.22, r.z - r.depth / 2 - 0.1), undefined);
  assert.equal(libraryDoor.at, r.x - r.width / 2);
  for (let dx = -0.8; dx <= 0.8; dx += 0.025)
    assert(
      floorClear([libraryDoor.at + dx, 0.085, libraryDoor.along], 'resident'),
    );
  for (const route of libraryRoutes)
    for (let i = 1; i < route.length; i++)
      assert(
        segmentClear(world(route[i - 1]), world(route[i]), 'resident'),
        `Blocked library route ${JSON.stringify(route[i - 1])} → ${JSON.stringify(route[i])}`,
      );
});

test('furniture fits without overlap and leaves the entire moving ladder lane clear', () => {
  const items = Object.entries(libraryFurniture);
  for (const [id, f] of items) {
    assert(Math.abs(f.x) + f.width / 2 <= 4.41, id);
    assert(Math.abs(f.z) + f.depth / 2 <= 4.41, id);
    if (id !== 'eastShelves')
      assert(separate(f, libraryLadderLane), `${id} blocks ladder travel`);
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      assert(
        separate(items[i][1], items[j][1]),
        `${items[i][0]} overlaps ${items[j][0]}`,
      );
  const readingSeats = seats.filter((s) => s.room === 'library');
  assert.equal(readingSeats.length, 4);
  assert(readingSeats.every((s) => s.offset[1] >= 0.84 && s.offset[1] <= 0.94));
});

test('borrow, turn, bookmark limits and returning preserve an internally consistent book', () => {
  const lib = createLibraryState();
  const advance = () => {
    for (let i = 0; i < 9; i++) lib.update(0.1);
  };
  assert(!lib.command({ type: 'page', direction: 1 }));
  assert(!lib.command({ type: 'borrow', book: '__proto__' }));
  assert(lib.command({ type: 'borrow', book: 'journey', page: 1 }));
  assert.equal(lib.snapshot().phase, 'taking');
  assert(!lib.command({ type: 'page', direction: 1 }));
  advance();
  assert.equal(lib.snapshot().phase, 'reading');
  assert(lib.command({ type: 'page', direction: 1 }));
  assert.equal(lib.snapshot().previousPage, 1);
  assert.equal(lib.snapshot().page, 2);
  assert(
    !lib.command({ type: 'page', direction: -1 }),
    'A second command cannot interrupt a physical page turn',
  );
  advance();
  assert(lib.command({ type: 'page', direction: 1 }));
  advance();
  assert(
    !lib.command({ type: 'page', direction: 1 }),
    'No page after the final page',
  );
  assert(lib.command({ type: 'page', direction: -1 }));
  assert.equal(lib.snapshot().direction, -1);
  lib.command({ type: 'return' });
  assert(!lib.command({ type: 'page', direction: 1 }));
  advance();
  assert.equal(lib.snapshot().phase, 'shelved');
  lib.command({ type: 'borrow', book: 'house', page: 999 });
  assert.equal(lib.snapshot().page, libraryBooks.house.pages.length - 1);
  lib.command({ type: 'borrow', book: 'forest', page: -1 });
  assert.equal(lib.snapshot().page, 0);
  const copy = lib.snapshot();
  copy.page = 99;
  assert.equal(lib.snapshot().page, 0);
});

test('ladder reversal stays on its reserved track; globe and reduced motion are independent', () => {
  const lib = createLibraryState();
  assert(!lib.command({ type: 'ladder', stop: 3 }));
  assert(!lib.command({ type: 'ladder', stop: NaN }));
  lib.command({ type: 'ladder', stop: 0 });
  for (let i = 0; i < 20; i++) lib.update(0.1);
  const before = lib.snapshot().ladderPosition;
  lib.command({ type: 'ladder', stop: 2 });
  let previous = before;
  for (let i = 0; i < 100; i++) {
    lib.update(0.1);
    const current = lib.snapshot().ladderPosition;
    assert(current >= previous && current - previous <= 0.080001);
    assert(
      current >= libraryLadderStops[0] && current <= libraryLadderStops[2],
    );
    previous = current;
  }
  assert.equal(lib.snapshot().ladderPosition, libraryLadderStops[2]);
  lib.command({ type: 'globe' });
  lib.command({ type: 'ladder', stop: 0 });
  lib.update(0.1, true);
  assert.equal(lib.snapshot().ladderPosition, libraryLadderStops[0]);
  assert.equal(lib.snapshot().globeSpinning, false);
  lib.update(NaN);
  lib.update(-100);
  assert(Number.isFinite(lib.snapshot().age));
});

test('saved bookmarks reject corrupt, out-of-range or unavailable local storage', () => {
  globalThis.localStorage = { getItem: () => '{broken' };
  assert.deepEqual(readLibraryBookmarks(), { forest: 0, journey: 0, house: 0 });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ forest: 2, journey: -1, house: 4 }),
  };
  assert.deepEqual(readLibraryBookmarks(), { forest: 2, journey: 0, house: 0 });
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('disabled');
    },
  };
  assert.deepEqual(readLibraryBookmarks(), { forest: 0, journey: 0, house: 0 });
  delete globalThis.localStorage;
});
