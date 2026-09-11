import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createArcade,
  arcadeCommand,
  tickArcade,
  createGomoku,
  placeStone,
  gomokuReply,
  readGameRecords,
  gameStorageKey,
} from '../app/game-engine.ts';
import { rooms, roomAt } from '../app/house-data.ts';
import {
  gameFurniture,
  gameRoutes,
  expansionPortals,
  expansionReservations,
} from '../app/game-layout.ts';
import { floorClear, segmentClear } from '../app/life-navigation.ts';

await test('expansion modules, clear furniture footprints and accessible portals', () => {
  assert.equal(rooms.gaming.z, rooms.gallery.z);
  assert.equal(rooms.gaming.depth, rooms.gallery.depth);
  assert.equal(rooms.gaming.width / rooms.gallery.width, 1.125);
  assert.equal(rooms.corridor.width / rooms.gallery.width, 0.25);
  const items = Object.entries(gameFurniture);
  for (const [id, f] of items) {
    assert(Math.abs(f.x) + f.width / 2 <= 4.41, `${id} outside room in x`);
    assert(Math.abs(f.z) + f.depth / 2 <= 3.3, `${id} outside room in z`);
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const [an, a] = items[i],
        [bn, b] = items[j];
      assert(
        Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
          Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2,
        `${an} overlaps ${bn}`,
      );
    }
  for (const route of gameRoutes)
    for (let i = 1; i < route.length; i++) {
      const world = ([x, z]) => [x + rooms.gaming.x, 0.085, z + rooms.gaming.z];
      assert(
        segmentClear(world(route[i - 1]), world(route[i]), 'resident'),
        `blocked route ${JSON.stringify(route[i])}`,
      );
    }
  for (const portal of expansionPortals) {
    for (let dx = -0.6; dx <= 0.6; dx += 0.025)
      assert(
        floorClear([portal.at + dx, 0.085, portal.along], 'resident'),
        `blocked portal ${portal.a}/${portal.b}: ${dx}`,
      );
  }
  for (const bay of expansionReservations)
    assert.equal(
      roomAt(bay.x, bay.z),
      undefined,
      'Reserved bay must not be an occupied room',
    );
});
await test('blocks clear rows, finish the challenge and freeze on pause', () => {
  const g = createArcade('blocks', () => 0);
  g.status = 'playing';
  g.progress = 4;
  g.board[17] = [0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  g.piece = [[1, 1, 1, 1]];
  g.x = 0;
  g.y = 17;
  tickArcade(g);
  assert.equal(g.status, 'won');
  assert.equal(g.progress, 5);
  assert.equal(g.board.length, 18);
  assert(g.board[0].every((v) => !v));
  const p = createArcade('blocks');
  p.status = 'paused';
  const before = JSON.stringify(p);
  arcadeCommand(p, 'drop');
  tickArcade(p);
  assert.equal(JSON.stringify(p), before);
});
await test('blocks reject collisions and game over when a new piece is blocked', () => {
  const g = createArcade('blocks', () => 0);
  g.status = 'playing';
  g.x = 0;
  arcadeCommand(g, 'left');
  assert.equal(g.x, 0);
  g.piece = [
    [2, 2],
    [2, 2],
  ];
  g.x = 4;
  g.y = 16;
  g.board[0].fill(1);
  g.board[0][0] = 0;
  tickArcade(g, () => 0);
  assert.equal(g.status, 'lost');
});
await test('snake rejects instant reversals, detects collisions and wins after eight fruits', () => {
  const g = createArcade('snake');
  g.status = 'playing';
  arcadeCommand(g, 'up');
  arcadeCommand(g, 'left');
  assert.deepEqual(g.queued, [0, -1]);
  tickArcade(g);
  assert.deepEqual(g.snake[0], [5, 7]);
  g.snake = [
    [0, 0],
    [1, 0],
    [2, 0],
  ];
  g.direction = [-1, 0];
  g.queued = [-1, 0];
  tickArcade(g);
  assert.equal(g.status, 'lost');
  const w = createArcade('snake');
  w.status = 'playing';
  w.progress = 7;
  w.food = [6, 8];
  tickArcade(w);
  assert.equal(w.status, 'won');
  assert.equal(w.progress, 8);
  const tail = createArcade('snake');
  tail.status = 'playing';
  tail.snake = [
    [2, 2],
    [2, 3],
    [1, 3],
    [1, 2],
  ];
  tail.queued = [-1, 0];
  tail.food = [9, 9];
  tickArcade(tail);
  assert.equal(tail.status, 'playing', 'Vacating tail cell is legal');
});
await test('gomoku detects wins in all four axes and rejects occupied or out-of-range cells', () => {
  for (const step of [1, 15, 16, 14]) {
    const g = createGomoku();
    const start = step === 14 ? 10 : 16;
    for (let i = 0; i < 5; i++) {
      g.turn = 1;
      assert(placeStone(g, start + i * step));
    }
    assert.equal(g.winner, 1);
    assert.equal(g.line.length, 5);
    assert(!placeStone(g, 200));
  }
  const g = createGomoku();
  assert(!placeStone(g, -1));
  assert(!placeStone(g, 225));
  assert(!placeStone(g, 1.5));
  assert(placeStone(g, 112));
  assert(!placeStone(g, 112));
  assert.equal(g.turn, 2);
  const edge = createGomoku();
  for (const i of [13, 14, 15, 16, 17]) {
    edge.turn = 1;
    placeStone(edge, i);
  }
  assert.equal(edge.winner, 0, 'Rows cannot wrap');
});
await test('local gomoku opponent takes wins and blocks four-in-a-row', () => {
  const g = createGomoku();
  for (const i of [109, 110, 111, 112]) g.cells[i] = 1;
  g.turn = 2;
  assert([108, 113].includes(gomokuReply(g)));
  for (const i of [46, 47, 48, 49]) g.cells[i] = 2;
  assert([45, 50].includes(gomokuReply(g)));
});
await test('browser records are sanitized and tolerate unavailable storage', () => {
  globalThis.localStorage = {
    getItem: (key) =>
      key === gameStorageKey
        ? JSON.stringify({
            blocks: { wins: 2, best: 1200 },
            snake: { wins: -1, best: 'wrong' },
            gomoku: { wins: 1e20, best: 0 },
          })
        : null,
  };
  const r = readGameRecords();
  assert.equal(r.blocks.wins, 2);
  assert.equal(r.snake.wins, 0);
  assert.equal(r.snake.best, 0);
  assert.equal(r.gomoku.wins, 0);
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('denied');
    },
  };
  assert.equal(readGameRecords().blocks.wins, 0);
  delete globalThis.localStorage;
});
