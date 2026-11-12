import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { bookContact } from '../app/hand-contact.ts';
import { createHeldAction } from '../app/held-action.ts';
import { LifeEngine } from '../app/life-engine.ts';
import { navigationNodes } from '../app/life-data.ts';
import { worldPoint } from '../app/life-navigation.ts';

test('book support remains aligned with both palms under rotated and asymmetrical poses', () => {
  for (let i = 0; i < 100; i++) {
    const q = new T.Quaternion().setFromEuler(
      new T.Euler(i / 100, i / 13, 0.1),
    );
    const left = new T.Vector3(-0.16, 0.3, 0.25).applyQuaternion(q);
    const right = new T.Vector3(0.16, 0.3 + i / 5000, 0.25).applyQuaternion(q);
    const up = new T.Vector3(0, 1, 0).applyQuaternion(q);
    const forward = new T.Vector3(0, 0, 1).applyQuaternion(q);
    const c = bookContact(left, right, up, forward);
    const normal = new T.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
    assert.ok(
      normal.dot(up) > 0.8 && normal.dot(forward) < -0.4,
      'pages face the reader',
    );
    for (const [sign, palm] of [
      [-1, left],
      [1, right],
    ]) {
      const contact = new T.Vector3((sign * (c.width - 0.035)) / 2, -0.025, 0)
        .applyQuaternion(c.quaternion)
        .add(c.position);
      assert.ok(contact.distanceTo(palm) < 1e-6, 'each palm supports an edge');
    }
  }
});
test('object changes lower the old item before raising another; interrupted movement remains continuous', () => {
  const action = createHeldAction();
  for (let i = 0; i < 120; i++)
    assert.deepEqual(action.sample(0, 1, 1 / 60), { kind: 0, amount: 0 });
  let previous = 0;
  for (let i = 0; i < 120; i++) {
    const s = action.sample(3, 1, 1 / 60);
    assert.ok(Math.abs(s.amount - previous) < 0.065);
    previous = s.amount;
  }
  let lowered = false,
    changed = false;
  for (let i = 0; i < 120; i++) {
    const s = action.sample(2, 1, 1 / 60);
    if (s.amount === 0) lowered = true;
    if (s.kind === 2 && s.amount > 0) {
      assert.ok(lowered);
      changed = true;
    }
    assert.ok(Math.abs(s.amount - previous) < 0.065);
    previous = s.amount;
  }
  assert.ok(changed);
  for (let i = 0; i < 60; i++) action.sample(0, 0, 1 / 60);
  assert.deepEqual(action.sample(0, 0, 1 / 60), { kind: 0, amount: 0 });
});
const hooks = { collect() {}, bubble() {}, sound() {}, coffee() {} };
test('owner invitations create a real route and a rise transition without teleporting or interrupting travel', () => {
  const e = new LifeEngine(42, hooks);
  e.clock = 20;
  const a = e.actors.resident;
  a.active = true;
  a.path = [];
  a.seatTransition = undefined;
  e.events.active = null;
  const n = navigationNodes.find((n) => n.id === 'study.chair');
  a.node = n.id;
  a.room = n.room;
  a.position = worldPoint(n);
  a.seated = true;
  e.occupancy.release('resident');
  e.events.nextAutomatic = 200;
  assert.equal(
    e.hostAction('tour'),
    true,
    'explicit invitation bypasses automatic-event delay',
  );
  assert.ok(a.path.length > 0);
  assert.ok(a.seatTransition && !a.seatTransition.entering);
  assert.deepEqual(a.position, worldPoint(n));
  assert.equal(e.hostAction('read'), false, 'wait until walking is complete');
});

test('a coffee invitation continues into preparation after reaching the bar', () => {
  let prepared = 0;
  const e = new LifeEngine(42, {
    ...hooks,
    coffee() {
      prepared++;
    },
  });
  e.clock = 20;
  e.events.nextAutomatic = 200;
  e.events.active = null;
  const a = e.actors.resident,
    n = navigationNodes.find((n) => n.id === 'cafe.window');
  a.node = n.id;
  a.room = n.room;
  a.position = worldPoint(n);
  a.seated = false;
  a.path = [];
  e.occupancy.release('resident');
  assert.equal(e.hostAction('coffee'), true);
  for (let i = 0; i < 1800 && !prepared; i++)
    e.update(0.05, {
      view: 'overview',
      environment: { time: 'afternoon', weather: 'clear' },
      reduced: false,
      paused: false,
    });
  assert.equal(prepared, 1);
  assert.equal(a.node, 'cafe.barInside');
  assert.equal(a.fsm.state, 'brewCoffee');
});
