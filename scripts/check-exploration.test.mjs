import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CuriosityMotion } from '../app/curiosity-motion.ts';
import {
  curiosities,
  curiosityIds,
  isCuriosity,
  explorationProgress,
} from '../app/exploration-data.ts';
import { rooms, roomForObject } from '../app/house-data.ts';
import { collectionCards } from '../app/life-data.ts';
import {
  createCollectionStore,
  readCollections,
} from '../app/life-collections.ts';

test('the clue journey covers every room and returns home without dead ends', () => {
  assert.deepEqual(
    new Set(curiosityIds.map((id) => curiosities[id].room)),
    new Set(Object.keys(rooms)),
  );
  const visited = new Set();
  let current = 'studyOrrery';
  for (let i = 0; i < 10; i++) {
    assert(isCuriosity(current));
    assert(!visited.has(current));
    visited.add(current);
    const item = curiosities[current];
    assert.equal(roomForObject(current), item.room);
    assert.equal(collectionCards[item.collection].title, item.title);
    current = item.next;
  }
  assert.equal(current, 'studyOrrery');
  assert(!isCuriosity('toString'));
});

test('actions cannot stack, pause without skipping, and complete exactly once', () => {
  for (const item of Object.values(curiosities)) {
    const motion = new CuriosityMotion(item.duration);
    assert(motion.start());
    assert(!motion.start());
    assert(!motion.update(item.duration * 0.4, false, false));
    const progress = motion.progress;
    assert(!motion.update(10000, true, false));
    assert.equal(motion.progress, progress);
    for (const bad of [-1, NaN, Infinity]) motion.update(bad, false, false);
    assert.equal(motion.progress, progress);
    assert(motion.update(item.duration, false, false));
    assert.equal(motion.progress, 1);
    assert(!motion.active);
    assert(!motion.update(10, false, false));
    assert(motion.start());
    assert.equal(motion.runs, 2);
    assert(!motion.opened);
  }
});

test('reduced motion presents the final state, including after a paused visit', () => {
  const motion = new CuriosityMotion(8);
  motion.start();
  motion.update(1, false, false);
  assert(!motion.update(0, true, true));
  assert(motion.active);
  assert(motion.update(0, false, true));
  assert.equal(motion.progress, 1);
});

test('discoveries persist, merge separate room acquisitions, and survive blocked storage', () => {
  const oldStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  try {
    let savedData;
    const notices = [];
    const store = createCollectionStore((id, data, saved) => {
      notices.push({ id, saved });
      savedData = data;
    });
    const other = createCollectionStore(() => {});
    assert(other.collect('story.pressedLeaf', 'house', 'study'));
    for (const item of Object.values(curiosities)) {
      assert(store.collect(item.collection, 'house', item.room));
      assert(!store.collect(item.collection, 'house', item.room));
    }
    const loaded = readCollections();
    assert(loaded['story.pressedLeaf']);
    assert.deepEqual(explorationProgress(loaded), {
      found: 10,
      total: 10,
      next: null,
    });
    assert.equal(notices.length, 10);
    assert.deepEqual(explorationProgress({ 'story.pressedLeaf': true }), {
      found: 0,
      total: 10,
      next: 'studyOrrery',
    });
    values.clear();
    storage.setItem = () => {
      throw new Error('storage unavailable');
    };
    const fallback = createCollectionStore((id, data, saved) => {
      notices.push({ id, saved });
      savedData = data;
    });
    assert(fallback.collect('wander.orbits', 'house', 'study'));
    assert(!notices.at(-1).saved);
    assert(savedData['wander.orbits']);
    assert(!fallback.collect('wander.orbits', 'house', 'study'));
  } finally {
    if (oldStorage)
      Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else delete globalThis.localStorage;
  }
});
