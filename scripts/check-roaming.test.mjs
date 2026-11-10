import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveRoamer, roamSpawn } from '../app/roam-movement.ts';
import { floorClear, lifePortals } from '../app/life-navigation.ts';
import { rooms, roomAt } from '../app/house-data.ts';
import {
  ResidentDialogue,
  weatherDialogue,
  timeDialogue,
} from '../app/resident-dialogue.ts';

void test('every room has a safe entrance and input cannot leave the floor or cross furniture', () => {
  for (const room of Object.keys(rooms)) {
    const start = roamSpawn(room);
    assert.equal(roomAt(start[0], start[2]), room);
    assert(floorClear(start, 'resident'), room);
    for (const direction of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
    ]) {
      let p = start;
      for (let i = 0; i < 800; i++) {
        const next = moveRoamer(p, direction, 0.05);
        assert(floorClear(next, 'resident'), `${room}: ${next.join(',')}`);
        assert(Math.hypot(next[0] - p[0], next[2] - p[2]) <= 0.068);
        p = next;
      }
    }
  }
});
void test('all internal doorways can be crossed on foot in both directions', () => {
  for (const portal of lifePortals) {
    const axis = portal.axis === 'x' ? 0 : 2,
      along = axis === 0 ? 2 : 0;
    for (const direction of [-1, 1]) {
      let p = [0, 0.085, 0];
      p[axis] = portal.at - direction * 0.55;
      p[along] = portal.along;
      assert(
        floorClear(p, 'resident'),
        `${portal.a}/${portal.b}: start ${p.join(',')}`,
      );
      const startRoom = roomAt(p[0], p[2]);
      for (let i = 0; i < 18; i++)
        p = moveRoamer(p, axis === 0 ? [direction, 0] : [0, direction], 0.05);
      assert.notEqual(
        roomAt(p[0], p[2]),
        startRoom,
        `${portal.a}/${portal.b} ${direction}`,
      );
    }
  }
});
void test('diagonal normalization, lag limits, idle and nearby characters', () => {
  const p = roamSpawn('gallery');
  assert.deepEqual(moveRoamer(p, [0, 0], 1), p);
  assert.deepEqual(moveRoamer(p, [NaN, 0], 1), p);
  assert.deepEqual(moveRoamer(p, [1, 1], 100), moveRoamer(p, [1, 1], 0.05));
  const move = moveRoamer(p, [1, 1], 0.05);
  assert(Math.hypot(move[0] - p[0], move[2] - p[2]) <= 1.35 * 0.05 + 0.000001);
  assert.deepEqual(moveRoamer(p, [1, 0], 0.05, [[p[0] + 0.6, 0.085, p[2]]]), p);
});
void test('dialogue follows each weather and time, cycles rooms and avoids immediate repetition', () => {
  for (const weather of Object.keys(weatherDialogue))
    for (const time of Object.keys(timeDialogue)) {
      const dialogue = new ResidentDialogue();
      const env = { weather, time };
      const first = dialogue.next(env, 'cafe', () => 0);
      assert(weatherDialogue[weather].includes(first));
      const second = dialogue.next(env, 'cafe', () => 0);
      assert(timeDialogue[time].includes(second));
      const messages = [first, second];
      for (let i = 0; i < 10; i++)
        messages.push(dialogue.next(env, 'cafe', () => 0));
      for (let i = 1; i < messages.length; i++)
        assert.notEqual(messages[i], messages[i - 1]);
      assert(new Set(messages).size >= 10);
    }
});

void test('walk easing gives gentle starts, stops on release, and normalizes diagonals', async () => {
  const { easeRoamInput } = await import('../app/roam-movement.ts');
  let velocity = easeRoamInput([0, 0], [1, 1], 1 / 60);
  assert(Math.hypot(...velocity) > 0.1 && Math.hypot(...velocity) < 0.4);
  for (let i = 0; i < 90; i++)
    velocity = easeRoamInput(velocity, [1, 1], 1 / 60);
  assert(Math.abs(Math.hypot(...velocity) - 1) < 0.0001);
  assert.deepEqual(easeRoamInput(velocity, [0, 0], 1 / 60), [0, 0]);
  assert.deepEqual(easeRoamInput(velocity, [NaN, 0], 1 / 60), [0, 0]);
});
void test('fast walking still respects furniture, doorways, actor separation and lag limits', () => {
  for (const room of Object.keys(rooms)) {
    let p = roamSpawn(room);
    for (let i = 0; i < 180; i++) {
      p = moveRoamer(p, [Math.cos(i / 40), Math.sin(i / 40)], 0.05, [], 1.7);
      assert(floorClear(p, 'resident'));
    }
    assert.deepEqual(
      moveRoamer(p, [1, 0], 10, [], 1.7),
      moveRoamer(p, [1, 0], 0.05, [], 1.7),
    );
  }
  const p = roamSpawn('gallery');
  assert.deepEqual(
    moveRoamer(p, [1, 0], 0.05, [[p[0] + 0.6, 0.085, p[2]]], 1.7),
    p,
  );
});
void test('camera distance is bounded, reversible and stable with invalid saved values', async () => {
  const { adjustRoamZoom, defaultRoamZoom } =
    await import('../app/roam-camera.ts');
  const near = adjustRoamZoom(defaultRoamZoom, -0.18);
  assert(near < defaultRoamZoom);
  assert(Math.abs(adjustRoamZoom(near, 0.18) - defaultRoamZoom) < 1e-12);
  assert.equal(adjustRoamZoom(NaN, 0), defaultRoamZoom);
  assert.equal(adjustRoamZoom(defaultRoamZoom, Infinity), defaultRoamZoom);
  let close = defaultRoamZoom,
    far = defaultRoamZoom;
  for (let i = 0; i < 100; i++) {
    close = adjustRoamZoom(close, -1);
    far = adjustRoamZoom(far, 1);
  }
  assert.equal(close, 0.46);
  assert.equal(far, 1.3);
  assert.equal(adjustRoamZoom(close, -1), close);
  assert.equal(adjustRoamZoom(far, 1), far);
});

void test('incoming visitors separate from the roaming character without crossing furniture', async () => {
  const { resolveRoamerOverlap } = await import('../app/roam-movement.ts');
  for (const room of Object.keys(rooms)) {
    const start = roamSpawn(room),
      other = [...start];
    let p = start;
    for (let i = 0; i < 90; i++) {
      const next = resolveRoamerOverlap(p, [other], 1 / 60);
      assert.ok(floorClear(next, 'resident', 0.31));
      assert.ok(
        Math.hypot(next[0] - other[0], next[2] - other[2]) >=
          Math.hypot(p[0] - other[0], p[2] - other[2]) - 1e-8,
      );
      assert.ok(Math.hypot(next[0] - p[0], next[2] - p[2]) <= 0.85 / 60 + 1e-8);
      p = next;
    }
    assert.ok(Math.hypot(p[0] - other[0], p[2] - other[2]) > 0.5);
    assert.deepEqual(resolveRoamerOverlap(start, [], 1 / 60), start);
  }
});
