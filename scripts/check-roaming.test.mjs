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
