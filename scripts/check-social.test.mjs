import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresenceStore } from './seat-presence.mjs';
import {
  createVisitorJourney,
  sampleVisitorJourney,
} from '../app/visitor-travel.mjs';
import { Group, MeshStandardMaterial, Box3, Vector3 } from 'three';
import { createInteriorDoor } from '../app/interior-doors.ts';

test('social interactions address a seated peer and are visible to both sessions', () => {
  let now = 1000;
  const store = createPresenceStore({ now: () => now });
  store.mutate('a', { action: 'sit', seatId: 'cafe-chair-1', name: '小禾' });
  const b = store.mutate('b', {
    action: 'sit',
    seatId: 'cafe-chair-2',
    name: '小林',
  }).me;
  for (const kind of ['offerCoffee', 'applaud', 'thanks']) {
    const result = store.mutate('a', { action: 'gesture', kind, targetId: b });
    const event = result.visitors.find((p) => p.id === result.me).gesture;
    assert.equal(event.targetId, b);
    assert.equal(event.kind, kind);
    assert.deepEqual(
      store.snapshot('b').visitors.find((p) => p.id === result.me).gesture,
      event,
    );
    assert(!('lastSocial' in result.visitors[0]));
    assert.throws(
      () => store.mutate('a', { action: 'gesture', kind, targetId: b }),
      (e) => e.status === 429,
    );
    now += 9001;
  }
  assert(!store.snapshot('b').visitors[0].gesture);
});
test('social interactions cannot target absent, walking, sleeping or other-room visitors', () => {
  let now = 1000;
  const store = createPresenceStore({ now: () => now });
  store.mutate('a', { action: 'sit', seatId: 'cafe-chair-1', name: '小禾' });
  const b = store.mutate('b', {
    action: 'sit',
    seatId: 'study-work',
    name: '小林',
  }).me;
  const send = (targetId) =>
    store.mutate('a', { action: 'gesture', kind: 'offerCoffee', targetId });
  assert.throws(
    () => send(),
    (e) => e.status === 400,
  );
  assert.throws(
    () => send('missing'),
    (e) => e.status === 409,
  );
  assert.throws(() => send(b), /同一个房间/);
  const trip = store
    .mutate('b', { action: 'sit', seatId: 'cafe-chair-2', name: '小林' })
    .visitors.find((v) => v.id === b).journey;
  assert.throws(() => send(b), /坐好/);
  now += trip.duration + 1;
  send(b);
  now += 9001;
  const bed = store
    .mutate('b', { action: 'rest', seatId: 'bedroom-bed-left', name: '小林' })
    .visitors.find((v) => v.id === b).journey;
  now += bed.duration + 1;
  assert.throws(() => send(b), /休息/);
  store.mutate('b', { action: 'leave' });
  assert.throws(
    () => send(b),
    (e) => e.status === 409,
  );
});
test('a recipient cannot receive rapid social bursts from multiple visitors', () => {
  let now = 1000;
  const store = createPresenceStore({ now: () => now });
  store.mutate('a', { action: 'sit', seatId: 'cafe-chair-1', name: '小禾' });
  const targetId = store.mutate('b', {
    action: 'sit',
    seatId: 'cafe-chair-2',
    name: '小林',
  }).me;
  store.mutate('c', { action: 'sit', seatId: 'cafe-chair-3', name: '小墨' });
  store.mutate('a', { action: 'gesture', kind: 'applaud', targetId });
  assert.throws(
    () => store.mutate('c', { action: 'gesture', kind: 'thanks', targetId }),
    (e) => e.status === 429,
  );
  now += 4001;
  store.mutate('c', { action: 'gesture', kind: 'thanks', targetId });
});
test('quicker transfer keeps legacy itineraries continuous at the walk boundary', () => {
  const j = createVisitorJourney(
    'cafe-chair-1',
    'gallery-bench-1',
    'sit',
    'sit',
    1000,
  );
  assert.equal(j.rise, 0.7);
  assert.equal(j.settle, 0.8);
  assert.equal(j.walkSpeed, 0.96);
  const legacy = {
    ...j,
    walk: (j.walk * 0.96) / 0.72,
    walkSpeed: undefined,
    approachSpeed: undefined,
    exit: (j.exit * 0.68) / 0.46,
    enter: (j.enter * 0.68) / 0.46,
  };
  for (const itinerary of [j, legacy]) {
    const at = 1000 + (itinerary.rise + itinerary.exit + itinerary.walk) * 1000;
    const a = sampleVisitorJourney(itinerary, at - 1),
      b = sampleVisitorJourney(itinerary, at + 1);
    assert(Math.hypot(...a.position.map((v, i) => v - b.position[i])) < 0.005);
  }
});
test('closed door hardware remains inside its architrave', () => {
  const p = new Group(),
    materials = [],
    oak = new MeshStandardMaterial(),
    brass = new MeshStandardMaterial();
  const door = createInteriorDoor(p, 2.65, oak, brass, materials);
  p.updateMatrixWorld(true);
  const size = new Box3().setFromObject(door.root).getSize(new Vector3());
  assert(size.x < 1.66, 'No exposed rail beyond the door frame');
  p.traverse((o) => o.geometry?.dispose());
  [oak, brass, ...materials].forEach((m) => m.dispose());
});
