import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  createPresenceStore,
  createPresenceHandler,
  normalizeIP,
  visitorIP,
} from './seat-presence.mjs';
import seats from '../app/seat-catalog.json' with { type: 'json' };

assert.equal(new Set(seats.map((s) => s.id)).size, seats.length);
assert.equal(seats.length, 48);
assert.equal(seats.filter((s) => s.kind === 'bed').length, 2);
for (const seat of seats) {
  assert(seat.offset.every(Number.isFinite));
  if (seat.id.startsWith('bar-stool-'))
    assert(seat.offset[1] > 1.2 && seat.offset[1] < 1.3);
  else assert(seat.offset[1] > 0.6 && seat.offset[1] < 1);
}
assert.equal(normalizeIP('::ffff:127.0.0.1'), '127.0.0.1');
assert.equal(normalizeIP('::1'), '127.0.0.1');
let now = 10_000;
const store = createPresenceStore({ now: () => now, ttl: 120000 });
const sit = (ip, seatId, name = '访客') =>
  store.mutate(ip, { action: 'sit', seatId, name });
const a = sit('192.0.2.1', seats[0].id, '小森');
assert.equal(a.visitors.length, 1);
assert(
  !JSON.stringify(a).includes('192.0.2.1'),
  'The API must not expose IP addresses',
);
const updated = sit('::ffff:192.0.2.1', seats[1].id, '新名字');
assert.equal(
  updated.visitors.length,
  1,
  'One IP must not create a second person',
);
assert.equal(updated.visitors[0].id, a.me);
assert.equal(updated.visitors[0].name, '新名字');
assert.throws(() => sit('192.0.2.2', seats[1].id), { status: 409 });
now += updated.visitors[0].journey.duration + 1;
assert.throws(() => sit('192.0.2.1', 'invented'), { status: 400 });
for (const name of ['', ' ', '<script>', '名'.repeat(17), '不\u200b可见'])
  assert.throws(() => sit('192.0.2.1', seats[0].id, name), { status: 400 });
assert.equal(
  store.snapshot('192.0.2.1').visitors[0].seatId,
  seats[1].id,
  'Failed moves retain the old seat',
);
store.mutate('192.0.2.1', { action: 'leave' });
const races = await Promise.allSettled(
  Array.from({ length: 20 }, (_, i) =>
    Promise.resolve().then(() => sit(`198.51.100.${i}`, seats[0].id)),
  ),
);
assert.equal(
  races.filter((r) => r.status === 'fulfilled').length,
  1,
  'Only one simultaneous claimant wins',
);
for (let i = 1; i < seats.length; i++) sit(`198.51.100.${i}`, seats[i].id);
assert.equal(store.snapshot('192.0.2.1').visitors.length, seats.length);
assert.throws(() => sit('203.0.113.1', seats[1].id), { status: 409 });
now += 119750;
store.mutate('198.51.100.0', { action: 'heartbeat' });
now += 500;
assert.equal(
  store.snapshot('192.0.2.1').visitors.length,
  1,
  'Only the connected visitor keeps their seat',
);
now += 120001;
assert.equal(store.snapshot('192.0.2.1').visitors.length, 0);

// Bed occupancy remains atomic and one-per-IP across sitting and resting.
const resting = createPresenceStore({ now: () => now });
const bed = seats.find((s) => s.kind === 'bed').id;
const sleep = resting.mutate('192.0.2.10', {
  action: 'rest',
  seatId: bed,
  name: '小眠',
  appearance: { character: 'fox' },
});
assert.equal(sleep.visitors[0].posture, 'rest');
assert.equal(sleep.capacity, 48);
assert.throws(
  () =>
    resting.mutate('192.0.2.11', {
      action: 'rest',
      seatId: bed,
      name: '另一人',
    }),
  { status: 409 },
);
assert.throws(
  () =>
    resting.mutate('192.0.2.10', {
      action: 'rest',
      seatId: seats[0].id,
      name: '小眠',
    }),
  { status: 400 },
);
assert.throws(
  () => resting.mutate('192.0.2.10', { action: 'gesture', kind: 'hello' }),
  { status: 409 },
);
const awake = resting.mutate('192.0.2.10', { action: 'wake' });
assert.equal(awake.visitors[0].posture, 'sit');
assert.equal(awake.visitors[0].seatId, bed);
assert.equal(awake.visitors[0].appearance.character, 'fox');
assert.throws(() => resting.mutate('192.0.2.10', { action: 'wake' }), {
  status: 409,
});
now += awake.visitors[0].journey.duration + 1;
const other = resting.mutate('192.0.2.11', {
  action: 'sit',
  seatId: seats[0].id,
  name: '小森',
});
const hello = resting.mutate('192.0.2.10', {
  action: 'gesture',
  kind: 'hello',
  targetId: other.me,
});
assert.equal(
  hello.visitors.find((v) => v.id === hello.me).gesture.targetId,
  other.me,
);
assert(!JSON.stringify(hello).includes('lastGesture'));
assert.throws(
  () => resting.mutate('192.0.2.10', { action: 'gesture', kind: 'heart' }),
  { status: 429 },
);
now += 2600;
const heart = resting.mutate('192.0.2.10', {
  action: 'gesture',
  kind: 'heart',
});
assert.equal(
  heart.visitors.find((v) => v.id === heart.me).gesture.kind,
  'heart',
);
now += 6600;
assert(
  resting.snapshot('192.0.2.10').visitors.every((v) => !v.gesture),
  'Transient reactions expire',
);
resting.mutate('192.0.2.10', { action: 'rest', seatId: bed, name: '小眠' });
assert.throws(
  () =>
    resting.mutate('192.0.2.11', {
      action: 'gesture',
      kind: 'hello',
      targetId: sleep.me,
    }),
  { status: 409 },
);
assert.throws(
  () =>
    resting.mutate('192.0.2.11', {
      action: 'gesture',
      kind: 'hello',
      targetId: 'departed',
    }),
  { status: 409 },
);
now +=
  resting.snapshot('192.0.2.10').visitors.find((v) => v.id === sleep.me).journey
    .duration + 1;
const move = resting.mutate('192.0.2.10', {
  action: 'sit',
  seatId: seats[1].id,
  name: '小眠',
});
assert.equal(move.visitors.length, 2);
assert.equal(move.visitors.find((v) => v.id === move.me).posture, 'sit');
assert.equal(
  move.visitors.find((v) => v.id === move.me).appearance.character,
  'fox',
);
assert.throws(
  () =>
    resting.mutate('192.0.2.12', {
      action: 'rest',
      seatId: bed,
      name: '新访客',
    }),
  { status: 409 },
);
now += move.visitors.find((v) => v.id === move.me).journey.duration + 1;
resting.mutate('192.0.2.12', { action: 'rest', seatId: bed, name: '新访客' });
assert.equal(
  resting.snapshot('192.0.2.12').visitors.length,
  3,
  'Completing the walk releases the bed',
);
const request = {
  headers: { 'x-real-ip': '203.0.113.6' },
  socket: { remoteAddress: '10.0.0.1' },
};
assert.equal(visitorIP(request), '10.0.0.1');
assert.equal(visitorIP(request, true), '203.0.113.6');
request.headers['x-real-ip'] = '203.0.113.6, 203.0.113.7';
assert.equal(
  visitorIP(request, true),
  '10.0.0.1',
  'Malformed proxy headers fall back to the socket',
);

const handle = createPresenceHandler();
const server = createServer((req, res) => {
  void handle(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}/api/presence`;
  const post = (body, headers = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const responses = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      post(
        { action: 'sit', seatId: seats[i].id, name: '同 IP' },
        { 'X-Forwarded-For': `203.0.113.${i}`, 'X-Real-IP': `198.51.100.${i}` },
      ),
    ),
  );
  assert(responses.some((r) => r.status === 200));
  assert(
    responses.every((r) => [200, 409].includes(r.status)),
    'Rapid moves serialize while preserving the one-IP identity',
  );
  const state = await (await fetch(url)).json();
  assert.equal(
    state.visitors.length,
    1,
    'Forwarded headers cannot mint new identities',
  );
  assert.equal(
    (await post({ action: 'leave' }, { Origin: 'https://example.com' })).status,
    403,
  );
  assert.equal((await post(null)).status, 400);
  assert.equal(
    (
      await post({
        action: 'sit',
        seatId: seats[0].id,
        name: '很长'.repeat(2000),
      })
    ).status,
    413,
  );
  assert.equal((await fetch(url, { method: 'DELETE' })).status, 405);
  assert.equal((await post({ action: 'leave' })).status, 200);
  assert.equal((await (await fetch(url)).json()).visitors.length, 0);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  '48 places; atomic bed rest/wake, sleeping privacy, shared gestures, cooldown/expiry, IP identity, capacity and HTTP boundaries passed.',
);
