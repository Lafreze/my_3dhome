import assert from 'node:assert/strict';
import { SeatedIdle } from '../app/seated-idle.ts';
const ids = Array.from({ length: 12 }, (_, i) => `visitor-${i}`);
function simulate(seed) {
  const scheduler = new SeatedIdle(seed),
    events = [];
  let previous = null,
    previousEnd = null;
  for (let step = 0; step < 24000; step++) {
    scheduler.update(0.05, ids, false, false, false);
    const { clock, active } = scheduler.snapshot();
    const visible = ids
      .map((id) => scheduler.sample(id))
      .filter((s) => s.amount > 0);
    assert(visible.length <= 1, 'At most one seated prop action');
    if (previous && !active) previousEnd = clock;
    if (active && !previous) {
      assert(clock >= 14, 'No first-screen activity');
      if (previousEnd !== null)
        assert(clock - previousEnd >= 20 && clock - previousEnd <= 60.1);
      assert(active.duration >= 7 && active.duration <= 12);
      assert.notEqual(
        events.at(-1)?.id,
        active.id,
        'Share the scene between visitors',
      );
      const recent = events.filter((e) => e.id === active.id).slice(-2);
      if (recent.length === 2 && recent.every((e) => e.kind === active.kind))
        assert.fail('Do not repeat the same prop three times');
      events.push(active);
    }
    previous = active;
  }
  assert(events.length > 15 && new Set(events.map((e) => e.kind)).size === 2);
  return events;
}
const events = simulate(71037);
assert.deepEqual(simulate(71037), events, 'Reproducible seeded sequence');
assert.notDeepEqual(
  simulate(71038),
  events,
  'Different visit seed changes timing',
);
const s = new SeatedIdle(19);
for (let i = 0; i < 1200; i++) s.update(0.05, [], false, false, false);
s.update(0.05, ['late-arrival'], false, false, false);
assert.equal(
  s.snapshot().active,
  null,
  'Newly seated visitors settle before acting',
);
for (let i = 0; i < 500; i++)
  s.update(0.05, ['late-arrival'], false, true, false);
assert.equal(
  s.snapshot().active,
  null,
  'A major house event delays new activity',
);
s.update(0.05, ['late-arrival'], false, false, false);
assert(s.snapshot().active);
const before = s.snapshot();
for (let i = 0; i < 100; i++)
  s.update(0.1, ['late-arrival'], true, false, false);
assert.deepEqual(
  s.snapshot(),
  before,
  'Reading a panel freezes the action clock',
);
s.update(0.05, [], false, false, false);
assert.equal(
  s.snapshot().active,
  null,
  'Walking, lying down or leaving view clears props',
);
for (let i = 0; i < 500; i++) s.update(0.05, ids, false, false, true);
assert.equal(
  s.snapshot().active,
  null,
  'Reduced motion suppresses prop gestures',
);
const clock = s.snapshot().clock;
s.update(3600, ids, false, true, false);
assert(s.snapshot().clock - clock < 0.101, 'No background-time catchup');
console.log(
  JSON.stringify({
    seededEvents: events.length,
    maxActive: 1,
    cooldown: '20–60 s',
    pause: true,
    delayedArrival: true,
    reduced: true,
  }),
);
