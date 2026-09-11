import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene, Group } from 'three';
import { createPresenceStore } from './seat-presence.mjs';
import {
  activities,
  sampleVisitorActivity,
  giftFlight,
} from '../app/visitor-activities.ts';
import { createVisitorGifts } from '../app/visitor-gifts.ts';

test('reading, sketching and flowers synchronize, expire and cannot control another visitor', () => {
  let now = 1000;
  const store = createPresenceStore({ now: () => now });
  const a = store.mutate('a', {
    action: 'sit',
    seatId: 'garden-reading-1',
    name: '小禾',
  }).me;
  const b = store.mutate('b', {
    action: 'sit',
    seatId: 'garden-reading-2',
    name: '小林',
  }).me;
  for (const [kind, spec] of Object.entries(activities)) {
    assert.throws(
      () => store.mutate('a', { action: 'gesture', kind, targetId: b }),
      /自己的|自己选择/,
    );
    const result = store.mutate('a', { action: 'gesture', kind });
    const event = result.visitors.find((v) => v.id === a).gesture;
    assert.equal(event.expiresAt - event.at, spec.duration);
    assert.equal(
      store.snapshot('b').visitors.find((v) => v.id === a).gesture.kind,
      kind,
    );
    assert.equal(sampleVisitorActivity(event, now - 1).amount, 0);
    assert.equal(sampleVisitorActivity(event, now + 1500).kind, spec.kind);
    assert.equal(sampleVisitorActivity(event, now + 1500).amount, 1);
    assert.equal(sampleVisitorActivity(event, now, true).amount, 1);
    assert.equal(sampleVisitorActivity(event, event.expiresAt).amount, 0);
    now += spec.duration + 1;
    assert(!store.snapshot('b').visitors.find((v) => v.id === a).gesture);
  }
  const moved = store
    .mutate('a', { action: 'sit', seatId: 'garden-lounge-1', name: '小禾' })
    .visitors.find((v) => v.id === a);
  assert.throws(
    () => store.mutate('a', { action: 'gesture', kind: 'sketch' }),
    /走向/,
  );
  now += moved.journey.duration + 1;
  const resting = store
    .mutate('a', { action: 'rest', seatId: 'bedroom-bed-left', name: '小禾' })
    .visitors.find((v) => v.id === a);
  now += resting.journey.duration + 1;
  assert.throws(
    () => store.mutate('a', { action: 'gesture', kind: 'readBook' }),
    /醒来/,
  );
});

test('gift trajectory is bounded, ends at the receiver and respects reduced motion', () => {
  let previous = 0;
  for (let now = 1000; now < 10000; now += 25) {
    const p = giftFlight(1000, now, 10000);
    assert(p.progress >= previous && p.progress <= 1);
    assert(p.lift >= 0 && p.lift <= 0.55);
    assert(p.scale >= 0 && p.scale <= 1);
    previous = p.progress;
  }
  assert.equal(previous, 1);
  assert.equal(giftFlight(1000, 999, 10000), null);
  assert.equal(giftFlight(1000, 10000, 10000), null);
  assert.deepEqual(giftFlight(1000, 1000, 10000, true), {
    progress: 1,
    lift: 0,
    scale: 1,
  });
});

test('physical gifts attach to the recipient and clear on movement, departure and expiry', () => {
  const scene = new Scene(),
    sender = new Group(),
    receiver = new Group();
  sender.position.set(2, 1, 2);
  receiver.position.set(4, 1, 2);
  scene.add(sender, receiver);
  const frames = new Map([
    ['a', { root: sender }],
    ['b', { root: receiver }],
  ]);
  const gifts = createVisitorGifts(scene);
  const pair = (kind) => [
    {
      id: 'a',
      gesture: { id: 'gift', kind, targetId: 'b', at: 1000, expiresAt: 10000 },
    },
    { id: 'b', posture: 'sit' },
  ];
  for (const kind of ['shareBook', 'shareFlowers', 'shareTea']) {
    const visitors = pair(kind);
    gifts.update(visitors, frames, 5000, false);
    assert.deepEqual(gifts.snapshot(), ['gift']);
    const root = scene.children.find((o) => o.name.startsWith('Visitor gift'));
    assert(Math.abs(root.position.x - 3.71) < 0.001);
    assert.equal(root.children.filter((o) => o.visible).length, 1);
    gifts.update(visitors, frames, 10000, false);
    assert.equal(gifts.snapshot().length, 0);
  }
  gifts.update(pair('shareFlowers'), frames, 3000, false);
  receiver.userData.moving = true;
  gifts.update(pair('shareFlowers'), frames, 3100, false);
  assert.equal(gifts.snapshot().length, 0);
  receiver.userData.moving = false;
  gifts.update(pair('shareBook'), frames, 4000, false);
  gifts.update([], frames, 4100, false);
  assert.equal(gifts.snapshot().length, 0);
  gifts.dispose();
  assert.equal(scene.children.length, 2);
});
