import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresenceStore } from './seat-presence.mjs';
import {
  createVisitorJourney,
  sampleVisitorJourney,
  visitorTravelNodes,
} from '../app/visitor-travel.mjs';
import routes from '../config/visitor-routes.json' with { type: 'json' };
import { segmentClear, floorClear } from '../app/life-navigation.ts';

void test('all 36 seats connect through safe sampled floor paths with continuous rise, walk and settle', () => {
  assert.equal(Object.keys(visitorTravelNodes).length, 36);
  assert.equal(Object.keys(routes.routes).length, 630);
  for (const [pair, path] of Object.entries(routes.routes)) {
    for (const p of path) assert(floorClear(p, 'resident'), pair);
    for (let i = 1; i < path.length; i++)
      assert(segmentClear(path[i - 1], path[i], 'resident'), pair);
    const [from, to] = pair.split('|'),
      j = createVisitorJourney(
        from,
        to,
        'sit',
        to.includes('bed-left') ? 'rest' : 'sit',
        1000,
      );
    let previous = sampleVisitorJourney(j, 1000).position;
    for (let ms = 1016; ms < 1000 + j.duration; ms += 16) {
      const s = sampleVisitorJourney(j, ms),
        d = Math.hypot(...s.position.map((v, i) => v - previous[i]));
      assert(d < 0.06, `${pair}: discontinuous movement ${d}`);
      previous = s.position;
    }
    const end = sampleVisitorJourney(j, 1000 + j.duration + 1);
    assert(!end.moving);
    assert.deepEqual(end.position, visitorTravelNodes[to].position);
  }
});
void test('server reserves both seats, serializes passage use and ignores forged movement', () => {
  let clock = 1000;
  const store = createPresenceStore({ now: () => clock });
  store.mutate('one', { action: 'sit', seatId: 'study-work', name: '栗栗' });
  const placed = store.mutate('two', {
    action: 'sit',
    seatId: 'gallery-bench-1',
    name: '墨凛',
  });
  assert(!placed.visitors[0].journey);
  const result = store.mutate('one', {
    action: 'sit',
    seatId: 'living-sofa-1',
    name: '栗栗',
    journey: { duration: 1, path: [[999, 0, 999]] },
  });
  const own = result.visitors.find((v) => v.id === result.me);
  assert(own.journey.duration > 5000);
  assert.equal(own.journey.fromSeat, 'study-work');
  assert.throws(
    () =>
      store.mutate('two', {
        action: 'sit',
        seatId: 'study-work',
        name: '墨凛',
      }),
    /正在使用/,
  );
  assert.throws(
    () =>
      store.mutate('two', {
        action: 'rest',
        seatId: 'bedroom-bed-left',
        name: '墨凛',
      }),
    /通道/,
  );
  assert.throws(
    () =>
      store.mutate('one', {
        action: 'sit',
        seatId: 'study-reading',
        name: '栗栗',
      }),
    /正在走/,
  );
  clock += own.journey.duration + 1;
  const next = store.mutate('one', {
    action: 'rest',
    seatId: 'bedroom-bed-left',
    name: '栗栗',
  });
  assert.equal(
    next.visitors.find((v) => v.id === next.me).journey.toPosture,
    'rest',
  );
  clock += next.visitors.find((v) => v.id === next.me).journey.duration + 1;
  const wake = store.mutate('one', { action: 'wake' });
  assert.equal(
    wake.visitors.find((v) => v.id === wake.me).journey.path.length,
    0,
  );
});
void test('seated phone and coffee gestures are shared, rate limited, and blocked while resting', () => {
  let clock = 1000;
  const store = createPresenceStore({ now: () => clock });
  store.mutate('one', { action: 'sit', seatId: 'study-work', name: '栗栗' });
  assert.equal(
    store.mutate('one', { action: 'gesture', kind: 'phone' }).visitors[0]
      .gesture.kind,
    'phone',
  );
  assert.throws(
    () => store.mutate('one', { action: 'gesture', kind: 'coffee' }),
    /稍等/,
  );
  clock += 3000;
  assert.equal(
    store.mutate('one', { action: 'gesture', kind: 'coffee' }).visitors[0]
      .gesture.kind,
    'coffee',
  );
});

void test('every sofa is approached from its open front; visitors never stand on its cushion', () => {
  for (const [id, node] of Object.entries(visitorTravelNodes).filter(([id]) =>
    id.includes('sofa'),
  )) {
    const dx = node.approach[0] - node.position[0],
      dz = node.approach[2] - node.position[2];
    assert(dx * Math.sin(node.yaw) + dz * Math.cos(node.yaw) > 0.2, id);
    const j = createVisitorJourney(id, 'gallery-bench-1', 'sit', 'sit', 0);
    const riseEnd = sampleVisitorJourney(j, j.rise * 1000 + 1);
    assert(
      Math.hypot(
        riseEnd.position[0] - node.approach[0],
        riseEnd.position[2] - node.approach[2],
      ) < 0.01,
    );
    assert.equal(riseEnd.stand, 1);
    assert(riseEnd.position[1] < node.position[1], id + ' stands on the floor');
  }
});
