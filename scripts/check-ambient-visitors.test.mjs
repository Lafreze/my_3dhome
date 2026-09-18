import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientVisitors } from '../app/ambient-visitors.ts';
import seats from '../app/seat-catalog.json' with { type: 'json' };

test('ambient guests are varied, bounded and give real people and the resident priority', () => {
  const guests = createAmbientVisitors(714);
  const people = [{ id: 'real', name: '真实访客', seatId: 'study-sofa-1' }];
  const initial = guests.update(1000, 'study', people, 'study-work');
  assert.equal(initial.length, 3);
  assert.equal(new Set(initial.map((g) => g.appearance.character)).size, 3);
  assert.equal(new Set(initial.map((g) => g.appearance.topColor)).size, 3);
  assert(
    initial.every(
      (g) =>
        g.id.startsWith('ambient-') &&
        !['study-sofa-1', 'study-work'].includes(g.seatId),
    ),
  );
  assert(
    initial.every((g) => seats.find((s) => s.id === g.seatId).kind !== 'bed'),
  );
  assert(
    initial.some((g) => seats.find((s) => s.id === g.seatId).room === 'study'),
  );
  assert.equal(people.length, 1);
  const taken = initial[0];
  const after = guests.update(
    1001,
    'study',
    [...people, { id: 'new', seatId: taken.seatId }],
    null,
    false,
    true,
  );
  assert.equal(after.length, 3);
  assert(!after.some((g) => g.seatId === taken.seatId));
  assert.equal(guests.update(999999, 'study', people, null, true), null);
});
test('ambient visits are reproducible; visible guests do not pop away on expiration', () => {
  const a = createAmbientVisitors(12),
    b = createAmbientVisitors(12);
  const first = a.update(1000, 'study', []);
  assert.deepEqual(b.update(1000, 'study', []), first);
  const visible = first.filter(
    (g) => seats.find((s) => s.id === g.seatId).room === 'study',
  );
  const later = a.update(400000, 'study', []) || first;
  for (const g of visible) assert(later.some((v) => v.id === g.id));
});
