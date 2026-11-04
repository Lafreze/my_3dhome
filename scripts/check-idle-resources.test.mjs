import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { visibleFrames, visibleInterval } from '../app/visibility-scheduler.ts';
import { createGeolocation } from './visitor-geolocation.mjs';

function fake() {
  const document = new EventTarget();
  document.hidden = false;
  let serial = 0;
  const timers = new Map(),
    frames = new Map();
  const env = {
    document,
    setTimeout: (fn) => {
      timers.set(++serial, fn);
      return serial;
    },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (fn) => {
      frames.set(++serial, fn);
      return serial;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  return {
    env,
    timers,
    frames,
    visible(value) {
      document.hidden = !value;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    frame(time = 16) {
      const next = frames.entries().next().value;
      if (next) {
        frames.delete(next[0]);
        next[1](time);
      }
    },
    timer() {
      const next = timers.entries().next().value;
      if (next) {
        timers.delete(next[0]);
        next[1]();
      }
    },
  };
}
const flush = () => new Promise((r) => setImmediate(r));
test('hidden polling owns zero timers, does not overlap requests and wakes exactly once', async () => {
  const f = fake();
  let calls = 0,
    finish;
  const stop = visibleInterval(
    () => {
      calls++;
      return new Promise((r) => (finish = r));
    },
    5000,
    { immediate: true },
    f.env,
  );
  assert.equal(calls, 1);
  f.visible(false);
  f.visible(true);
  assert.equal(calls, 1);
  finish();
  await flush();
  assert.equal(calls, 2);
  f.visible(false);
  finish();
  await flush();
  assert.equal(f.timers.size, 0);
  f.visible(true);
  assert.equal(calls, 3);
  stop();
  finish();
  await flush();
  assert.equal(f.timers.size, 0);
  f.visible(false);
  f.visible(true);
  assert.equal(calls, 3);
});
test('render loops sleep with hidden or covered scenes and restart without duplicate frames', () => {
  const f = fake();
  let count = 0,
    enabled = true,
    wakes = 0;
  const loop = visibleFrames(
    () => {
      count++;
    },
    { enabled: () => enabled, onWake: () => wakes++ },
    f.env,
  );
  loop.invalidate();
  loop.invalidate();
  assert.equal(f.frames.size, 1);
  f.frame();
  assert.equal(count, 1);
  f.visible(false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  loop.invalidate();
  assert.equal(f.frames.size, 0);
  f.visible(true);
  assert.equal(wakes, 1);
  f.frame();
  assert.equal(count, 2);
  enabled = false;
  loop.refresh();
  assert.equal(f.frames.size, 0);
  enabled = true;
  loop.refresh();
  assert.equal(f.frames.size, 1);
  loop.dispose();
  assert.equal(f.frames.size, 0);
  f.visible(false);
  f.visible(true);
  assert.equal(f.frames.size, 0);
});
test('static models stop after their final frame; low-rate scenes cancel delayed work when hidden', () => {
  const f = fake();
  let continuous = false;
  const loop = visibleFrames(() => continuous, { fps: () => 20 }, f.env);
  loop.invalidate();
  f.frame();
  assert.equal(f.frames.size + f.timers.size, 0);
  continuous = true;
  loop.invalidate();
  f.frame();
  assert.equal(f.timers.size, 1);
  f.visible(false);
  assert.equal(f.timers.size, 0);
  f.visible(true);
  f.frame();
  f.timer();
  assert.equal(f.frames.size, 1);
  loop.dispose();
});
test('GeoIP loads on demand, shares requests, unloads on idle and can wake again', async () => {
  const locate = await createGeolocation(undefined, { idleMs: 40 });
  try {
    assert.equal(locate.snapshot().loaded, false);
    assert.equal(await locate('127.0.0.1'), '本地 / 内网');
    assert.equal(locate.snapshot().loaded, false);
    const results = await Promise.all([locate('8.8.8.8'), locate('8.8.8.8')]);
    assert.equal(results[0], results[1]);
    assert.notEqual(results[0], '归属地未知');
    assert(locate.snapshot().loaded);
    await delay(150);
    assert.equal(locate.snapshot().loaded, false);
    assert.equal(await locate('8.8.8.8'), results[0]);
    assert.equal(locate.snapshot().loaded, false);
    assert.notEqual(await locate('1.1.1.1'), '归属地未知');
    assert.equal(locate.snapshot().loaded, true);
  } finally {
    await locate.close();
  }
  assert.equal(locate.snapshot().loaded, false);
});
test('GeoIP failure settles pending requests and releases its worker', async () => {
  const locate = await createGeolocation(
    new URL('../package.json', import.meta.url).pathname,
    { idleMs: 5 },
  );
  try {
    assert.equal(await locate('8.8.8.8'), '归属地未知');
    assert.equal(locate.snapshot().loaded, false);
    assert.equal(locate.snapshot().pending, 0);
  } finally {
    await locate.close();
  }
});
