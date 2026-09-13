import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCabinet,
  tickCabinet,
  emptyInput,
  cabinetIds,
  cabinetInfo,
  warehouseLevels,
  loadWarehouse,
  reversiFlips,
  reversiMoves,
  reversiMove,
  raceGate,
} from '../app/cabinet-engine.ts';
import { createArcade, arcadeCommand, tickArcade } from '../app/game-engine.ts';
const input = (keys = [], pressed = keys) => ({
  held: new Set(keys),
  pressed: new Set(pressed),
});
const playing = (id) => Object.assign(createCabinet(id), { status: 'playing' });
const advance = (g, seconds, i = emptyInput()) => {
  for (let t = 0; t < seconds; t += 1 / 120) tickCabinet(g, 1 / 120, i);
};

void test('nine cartridges have unique mechanics, and paused games do not advance', () => {
  assert.equal(new Set(['blocks', 'snake', ...cabinetIds]).size, 9);
  assert.equal(new Set(Object.values(cabinetInfo).map((i) => i.genre)).size, 7);
  for (const id of cabinetIds) {
    const g = createCabinet(id),
      before = JSON.stringify(g);
    tickCabinet(g, 1, input(['left', 'action']));
    assert.equal(JSON.stringify(g), before);
    g.status = 'paused';
    const paused = JSON.stringify(g);
    tickCabinet(g, 1, input(['right']));
    assert.equal(JSON.stringify(g), paused);
  }
});
void test('blocks use a seven-piece bag with a preview and complete the extended twenty-line challenge', () => {
  const g = createArcade('blocks', () => 0);
  g.status = 'playing';
  const seen = [];
  for (let n = 0; n < 7; n++) {
    seen.push(g.piece.flat().find(Boolean));
    g.board.forEach((row) => row.fill(0));
    arcadeCommand(g, 'drop');
  }
  assert.equal(new Set(seen).size, 7);
  assert(g.nextPiece.flat().some(Boolean));
  g.target = 20;
  g.progress = 19;
  g.piece = [[1, 1, 1, 1]];
  g.board.forEach((row) => row.fill(0));
  g.board[17] = [0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  g.x = 0;
  g.y = 17;
  tickArcade(g);
  assert.equal(g.status, 'won');
});
void test('pinball launches, bounces at a bumper and flipper, loses balls, and wins at target', () => {
  const g = playing('pinball');
  tickCabinet(g, 1 / 60, input(['action']));
  assert(g.launched);
  assert(g.vy < 0);
  Object.assign(g, { x: 285, y: 110, vx: 0, vy: 150, launching: false });
  advance(g, 0.12);
  assert(g.score >= 100);
  assert(g.vy < 0);
  Object.assign(g, { x: 304, y: 352, vx: 0, vy: 150 });
  advance(g, 0.1, input(['left'], []));
  assert(g.vy < 0, 'left flipper sends ball upward');
  Object.assign(g, { x: 360, y: 469, vx: 0, vy: 120, balls: 1 });
  tickCabinet(g, 0.01, emptyInput());
  assert.equal(g.status, 'lost');
  const win = playing('pinball');
  Object.assign(win, {
    launched: true,
    x: 285,
    y: 110,
    vx: 0,
    vy: 150,
    score: 4900,
  });
  advance(win, 0.2);
  assert.equal(win.status, 'won');
});
void test('rally steering, braking, boost, ordered checkpoints and timeout', () => {
  const g = playing('racing');
  advance(g, 0.5, input(['up'], []));
  assert(g.speed > 60);
  const angle = g.angle;
  advance(g, 0.2, input(['up', 'right'], []));
  assert(g.angle > angle);
  const speed = g.speed;
  advance(g, 0.2, input(['down'], []));
  assert(g.speed < speed);
  Object.assign(g, { x: 360, y: 385, speed: 180 });
  advance(g, 0.2, input(['up', 'action'], []));
  assert(g.fuel < 100);
  assert(g.speed > 180);
  for (let n = 0; n < 12; n++) {
    [g.x, g.y] = raceGate(g.checkpoint);
    g.speed = 0;
    tickCabinet(g, 0.01, emptyInput());
  }
  assert.equal(g.status, 'won');
  assert.equal(g.lap, 3);
  const lost = playing('racing');
  lost.time = 89.99;
  tickCabinet(lost, 0.04, emptyInput());
  assert.equal(lost.status, 'lost');
});
void test('shooter fires actual projectiles, destroys enemies, survives shield and finishes boss', () => {
  const g = playing('shooter');
  advance(g, 0.3, input(['action'], []));
  assert(g.shots.some((s) => !s.enemy));
  assert(g.enemies.length > 0);
  g.enemies = [{ x: 360, y: 115, hp: 1, phase: 0, boss: false }];
  g.shots = [{ x: 360, y: 126, vx: 0, vy: -400 }];
  tickCabinet(g, 0.02, emptyInput());
  assert.equal(g.enemies.length, 0);
  assert(g.score > 0);
  g.shots = [{ x: g.x, y: g.y, vx: 0, vy: 0, enemy: true }];
  const hp = g.hp;
  tickCabinet(g, 0.01, input(['extra']));
  assert.equal(g.hp, hp);
  assert.equal(g.bombs, 1);
  g.wave = 4;
  g.enemies = [{ x: 360, y: 80, hp: 1, phase: 0, boss: true }];
  g.shots = [{ x: 360, y: 87, vx: 0, vy: -400 }];
  tickCabinet(g, 0.02, emptyInput());
  tickCabinet(g, 0.01, emptyInput());
  assert.equal(g.status, 'won');
});
void test('platform gravity, grounded jumping, collectible pickup, checkpoints and delivery', () => {
  const g = playing('platform');
  advance(g, 0.4);
  assert(g.grounded);
  const ground = g.y;
  tickCabinet(g, 0.01, input(['action']));
  assert(g.vy < 0);
  advance(g, 0.1);
  assert(g.y < ground);
  Object.assign(g, { x: 140, y: 355, vy: 0 });
  tickCabinet(g, 0.01, emptyInput());
  assert(g.coins[0].taken);
  Object.assign(g, { x: 906, y: 382, vy: 0 });
  tickCabinet(g, 0.01, emptyInput());
  assert.equal(g.checkpoint, 905);
  Object.assign(g, { x: 812, y: 511, vy: 200 });
  tickCabinet(g, 0.01, emptyInput());
  assert.equal(g.lives, 2);
  assert.equal(g.x, 905);
  g.coins.slice(0, 6).forEach((c) => (c.taken = true));
  Object.assign(g, { x: 1745, y: 382, vy: 0 });
  tickCabinet(g, 0.01, emptyInput());
  assert.equal(g.status, 'won');
});
function solveWarehouse(g) {
  const encode = (p, b) => p + ':' + [...b].sort((a, b) => a - b).join(',');
  const queue = [{ p: g.player, b: [...g.boxes], path: [] }],
    seen = new Set([encode(g.player, g.boxes)]);
  for (let n = 0; n < queue.length && n < 300000; n++) {
    const { p, b, path } = queue[n];
    if (g.goals.every((v) => b.includes(v))) return path;
    for (const [key, d] of [
      ['left', -1],
      ['right', 1],
      ['up', -g.width],
      ['down', g.width],
    ]) {
      const next = p + d;
      if (g.walls.includes(next)) continue;
      const boxes = [...b],
        bi = boxes.indexOf(next);
      if (bi >= 0) {
        if (g.walls.includes(next + d) || boxes.includes(next + d)) continue;
        boxes[bi] += d;
      }
      const k = encode(next, boxes);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ p: next, b: boxes, path: [...path, key] });
      }
    }
  }
  return null;
}
void test('all five authored warehouses have solutions through real moves, with undo and blocked pushes', () => {
  const g = playing('sokoban');
  for (let level = 0; level < warehouseLevels.length; level++) {
    loadWarehouse(g, level);
    const solution = solveWarehouse(g);
    assert(solution, `warehouse ${level + 1} is solvable`);
    const original = g.player;
    tickCabinet(g, 0.01, input([solution[0]]));
    tickCabinet(g, 0.01, input(['extra']));
    assert.equal(g.player, original);
    assert.equal(g.moves, 0);
    for (const move of solution) tickCabinet(g, 0.01, input([move]));
    assert(g.solved);
    assert(g.goals.every((p) => g.boxes.includes(p)));
    if (level < 4) {
      tickCabinet(g, 0.01, input(['action']));
      assert.equal(g.level, level + 1);
    }
  }
  assert.equal(g.status, 'won');
});
void test('reversi validates captures, AI replies and legally plays a complete game including passes', () => {
  const g = playing('reversi');
  assert.deepEqual(reversiMoves(g.cells, 1), [19, 26, 37, 44]);
  assert.deepEqual(reversiFlips(g.cells, 19, 1), [27]);
  assert(!reversiMove(g, 0));
  assert(reversiMove(g, 19));
  assert.equal(g.cells[27], 1);
  advance(g, 0.6);
  assert.equal(g.cells.filter(Boolean).length, 6);
  for (let n = 0; n < 120 && g.status === 'playing'; n++) {
    if (g.turn === 1) {
      const legal = reversiMoves(g.cells, 1);
      assert(legal.length);
      reversiMove(g, legal[0]);
    } else advance(g, 0.6);
  }
  assert.notEqual(g.status, 'playing');
  assert(g.score >= 0);
});
void test('rhythm uses timing windows, combo, missed-note health and full-track win', () => {
  const good = playing('rhythm');
  for (let n = 0; n < 5300 && good.status === 'playing'; n++) {
    const i = emptyInput();
    for (const note of good.notes)
      if (!note.judged && Math.abs(note.at - (good.time + 1 / 120)) < 1 / 240)
        i.pressed.add('lane' + note.lane);
    tickCabinet(good, 1 / 120, i);
  }
  assert.equal(good.status, 'won');
  assert.equal(good.hits, 80);
  assert.equal(good.bestCombo, 80);
  const missed = playing('rhythm');
  advance(missed, 14);
  assert.equal(missed.status, 'lost');
  assert.equal(missed.hits, 0);
  const early = playing('rhythm');
  tickCabinet(early, 0.01, input(['lane0']));
  assert.equal(early.hits, 0);
  assert.equal(early.health, 97);
});

void test('pinball launcher clears the side rail and a complete game is winnable using only controls', () => {
  const g = playing('pinball'),
    i = input(['left', 'right'], []);
  for (let n = 0; n < 90 * 120 && g.status === 'playing'; n++) {
    i.pressed.clear();
    if (!g.launched) i.pressed.add('action');
    tickCabinet(g, 1 / 120, i);
  }
  assert.equal(g.status, 'won');
  assert(g.hits >= 20);
});
void test('platform jump can reach the raised platforms and their stars', () => {
  const g = playing('platform');
  g.x = 140;
  tickCabinet(g, 1 / 120, input(['right', 'action']));
  let onRaised = false;
  for (let n = 0; n < 100; n++) {
    tickCabinet(g, 1 / 120, input(['right'], []));
    if (g.grounded && g.y < 350) onRaised = true;
  }
  assert(onRaised);
  assert(g.coins[1].taken);
});
