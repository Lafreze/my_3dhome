import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  residentLeg,
  residentScale,
  residentStride,
  residentGesture,
} from '../app/resident-motion.ts';
import specs from '../config/character-rigs.json' with { type: 'json' };
import { humanHeight } from '../app/character-scale.mjs';
const thigh = specs.resident.hip - specs.resident.knee;
const shin = specs.resident.knee - specs.resident.ankle;
const leg = (d, amount, side) => residentLeg(d, amount, side, thigh, shin);

import { LifeEngine } from '../app/life-engine.ts';
import { worldPoint, distance } from '../app/life-navigation.ts';

void test('host matches cast height; feet stay planted while the support knee straightens', () => {
  assert.equal(residentScale * 1.3, humanHeight);
  const headShare =
    (specs.resident.height - specs.resident.neck) / specs.resident.height;
  assert.ok(
    headShare > 0.3 && headShare < 0.38,
    "host keeps the cast's large-head chibi silhouette",
  );
  assert.ok(leg(0, 1, 0).knee < 0.3, 'support knee straightens at mid-stance');
  for (let i = 0; i < 600; i++) {
    const d = (i / 600) * residentStride;
    for (const side of [0, 1]) {
      const g = leg(d, 1, side);
      const y =
        (thigh +
          shin -
          g.drop -
          thigh * Math.cos(g.hip) -
          shin * Math.cos(g.hip + g.knee)) *
        residentScale;
      const z =
        (-thigh * Math.sin(g.hip) - shin * Math.sin(g.hip + g.knee)) *
        residentScale;
      assert.ok(Math.abs(y - g.lift * residentScale) < 1e-5);
      assert.ok(Math.abs(z - g.z * residentScale) < 1e-5);
      assert.ok(Math.abs(g.hip + g.knee + g.ankle) < 1e-8);
      assert.ok(y >= -1e-5 && y < 0.04, 'no high marching steps');
      if (g.phase < 0.59) {
        const next = leg(d + 0.0001, 1, side);
        assert.ok(
          Math.abs((next.z - g.z) * residentScale + 0.0001) < 1e-8,
          'stance foot cancels actual world travel',
        );
      }
    }
  }
});

void test('greetings finish, sips pause at the mouth and return, and reduced motion is still', () => {
  assert.equal(residentGesture(6, 3).wave, 0);
  assert.equal(residentGesture(2, 0).sip, 0);
  assert.equal(residentGesture(2, 4).sip, 1);
  assert.equal(residentGesture(2, 7).sip, 0);
  for (const kind of [2, 6, 8, 12, 13]) {
    assert.deepEqual(
      residentGesture(kind, 100, true),
      residentGesture(kind, 0, true),
    );
    for (let age = 0; age < 12; age += 0.01) {
      const a = residentGesture(kind, age),
        b = residentGesture(kind, age + 0.01);
      for (const key of Object.keys(a))
        assert.ok(Math.abs(a[key] - b[key]) < 0.03, `${kind}/${key} jumps`);
    }
  }
});

void test('resident turns toward a route before translating and arrives at different frame rates', () => {
  for (const fps of [30, 60, 144]) {
    const e = new LifeEngine(42, {
      collect() {},
      bubble() {},
      sound() {},
      coffee() {},
    });
    e.clock = 30;
    e.nextCheck = Infinity;
    e.events.active = null;
    for (const a of Object.values(e.actors)) {
      a.active = false;
      a.stayUntil = Infinity;
    }
    const a = e.actors.resident,
      from = e.node('cafe.aisle1'),
      to = e.node('cafe.aisle2');
    Object.assign(a, {
      active: true,
      node: from.id,
      room: from.room,
      position: worldPoint(from),
      seated: false,
      seatTransition: undefined,
    });
    e.occupancy.actors.clear();
    e.occupancy.reservations.clear();
    assert.ok(e.go(a, to));
    a.rotation =
      Math.atan2(
        -(a.path[0][0] - a.position[0]),
        -(a.path[0][2] - a.position[2]),
      ) + Math.PI;
    const start = [...a.position];
    let moved = false;
    for (let frame = 0; frame < fps * 30 && a.path.length; frame++) {
      const before = [...a.position],
        yaw = a.rotation;
      e.update(1 / fps, {
        view: 'overview',
        environment: { time: 'afternoon', weather: 'clear' },
        reduced: false,
        paused: false,
      });
      const step = distance(before, a.position);
      if (a.path.length) {
        const turn = Math.abs(
          Math.atan2(Math.sin(a.rotation - yaw), Math.cos(a.rotation - yaw)),
        );
        assert.ok(turn <= 1.9 / fps + 1e-8);
        if (step > 1e-6) {
          const heading = Math.atan2(
            -(a.position[0] - before[0]),
            -(a.position[2] - before[2]),
          );
          assert.ok(
            Math.abs(
              Math.atan2(
                Math.sin(heading - a.rotation),
                Math.cos(heading - a.rotation),
              ),
            ) < 0.36,
            'no sideways glide',
          );
          moved = true;
        }
      }
      if (frame < fps / 2)
        assert.ok(distance(start, a.position) < 1e-8, 'turn in place first');
    }
    assert.ok(moved);
    assert.equal(a.node, to.id);
    assert.equal(a.path.length, 0);
  }
});
