import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresenceStore } from './seat-presence.mjs';
import expressions from '../app/visitor-expressions.json' with { type: 'json' };

test('wardrobe changes only the owner appearance, preserving seat and resting posture', () => {
  const store = createPresenceStore({ now: () => 1000 });
  store.mutate('me', {
    action: 'rest',
    seatId: 'bedroom-bed-left',
    name: '栗栗',
  });
  store.mutate('other', {
    action: 'sit',
    seatId: 'cafe-chair-1',
    name: '绯音',
  });
  const result = store.mutate('me', {
    action: 'appearance',
    name: '银铃',
    appearance: { character: 'cat' },
    seatId: 'cafe-chair-1',
  });
  const own = result.visitors.find((v) => v.id === result.me),
    other = result.visitors.find((v) => v.id !== result.me);
  assert.equal(own.name, '银铃');
  assert.equal(own.appearance.character, 'cat');
  assert.equal(own.seatId, 'bedroom-bed-left');
  assert.equal(own.posture, 'rest');
  assert(!own.journey);
  assert.equal(other.name, '绯音');
  assert.equal(other.seatId, 'cafe-chair-1');
  assert.throws(
    () =>
      store.mutate('me', {
        action: 'appearance',
        name: '<x>',
        appearance: { character: 'bear' },
      }),
    /名字/,
  );
  assert.throws(
    () =>
      store.mutate('me', {
        action: 'appearance',
        name: '栗栗',
        appearance: { character: 'invalid' },
      }),
    /外观/,
  );
  assert.equal(
    store.snapshot('me').visitors.find((v) => v.id === result.me).name,
    '银铃',
  );
});
test('expressions are shared, rate limited, cannot puppeteer another visitor, and expire', () => {
  let clock = 1000;
  const store = createPresenceStore({ now: () => clock });
  store.mutate('one', { action: 'sit', seatId: 'cafe-chair-1', name: '栗栗' });
  const peer = store.mutate('two', {
    action: 'sit',
    seatId: 'cafe-chair-2',
    name: '绯音',
  }).me;
  assert.throws(
    () =>
      store.mutate('one', { action: 'gesture', kind: 'smile', targetId: peer }),
    /自己的表情/,
  );
  for (const kind of Object.keys(expressions)) {
    const result = store.mutate('one', { action: 'gesture', kind });
    const own = result.visitors.find((v) => v.id === result.me);
    assert.equal(own.gesture.kind, kind);
    assert.equal(
      store.snapshot('two').visitors.find((v) => v.id === own.id).gesture.kind,
      kind,
    );
    assert.throws(
      () => store.mutate('one', { action: 'gesture', kind }),
      /稍等/,
    );
    clock += 7000;
    assert(
      !store.snapshot('one').visitors.find((v) => v.id === own.id).gesture,
    );
  }
});
test('wardrobe cannot reset a visitor journey in progress', () => {
  const store = createPresenceStore({ now: () => 1000 });
  store.mutate('one', { action: 'sit', seatId: 'study-work', name: '栗栗' });
  const result = store.mutate('one', {
    action: 'sit',
    seatId: 'cafe-chair-1',
    name: '栗栗',
  });
  assert(result.visitors[0].journey);
  assert.throws(
    () =>
      store.mutate('one', {
        action: 'appearance',
        name: '绯音',
        appearance: { character: 'rose' },
      }),
    /正在走/,
  );
  assert.equal(store.snapshot('one').visitors[0].name, '栗栗');
});
