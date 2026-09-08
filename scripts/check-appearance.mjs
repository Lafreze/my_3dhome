import assert from 'node:assert/strict';
import { createPresenceStore, validateAppearance } from './seat-presence.mjs';
import options from '../app/visitor-appearance.json' with { type: 'json' };
const s = createPresenceStore();
const appearance = {
  ...options.defaults,
  character: 'cat',
  gender: 'male',
  hairStyle: 'waves',
  hairColor: '#AB7342',
  eyeColor: '#426b87',
  topColor: '#94b0c0',
  bottomColor: '#514239',
  bearHood: false,
};
const sit = (ip, seatId, data = {}) =>
  s.mutate(ip, { action: 'sit', name: '小森', seatId, ...data });
const a = sit('192.0.2.1', 'study-work', { appearance });
assert.equal(a.visitors[0].appearance.hairColor, '#ab7342');
assert.equal(a.visitors[0].appearance.bearHood, false);
const saved = structuredClone(a.visitors[0].appearance);
a.visitors[0].appearance.topColor = '#ff0000';
assert.deepEqual(
  s.snapshot('192.0.2.1').visitors[0].appearance,
  saved,
  'Snapshots cannot mutate the saved outfit',
);
appearance.eyeColor = '#ffffff';
assert.deepEqual(
  s.snapshot('192.0.2.1').visitors[0].appearance,
  saved,
  'Request object is not retained',
);
assert.deepEqual(
  sit('192.0.2.1', 'living-sofa-1', { name: '换座位' }).visitors[0].appearance,
  saved,
  'Moving/renaming preserves the outfit',
);
sit('192.0.2.2', 'study-work');
assert.throws(
  () =>
    sit('192.0.2.1', 'study-work', { appearance: { hairColor: '#ff0000' } }),
  { status: 409 },
);
assert.deepEqual(
  s.snapshot('192.0.2.1').visitors[0].appearance,
  saved,
  'Seat conflict must not partially change appearance',
);
for (const invalid of [
  null,
  [],
  { character: 'invented' },
  { hairStyle: 'invented' },
  { gender: 'anything' },
  { bearHood: 'false' },
  { eyeColor: 'red' },
  { topColor: '#fff' },
  { bottomColor: 'url(file)' },
  { surprise: true },
  JSON.parse('{"__proto__":"#ffffff"}'),
  { constructor: '#ffffff' },
]) {
  assert.throws(
    () => sit('192.0.2.1', 'living-sofa-2', { appearance: invalid }),
    { status: 400 },
  );
  assert.deepEqual(s.snapshot('192.0.2.1').visitors[0].appearance, saved);
  assert.equal(s.snapshot('192.0.2.1').visitors[0].seatId, 'living-sofa-1');
}
for (const gender of options.genders)
  for (const hair of options.hairStyles)
    for (const bearHood of [true, false]) {
      const outfit = validateAppearance({
        ...options.defaults,
        gender: gender.id,
        hairStyle: hair.id,
        bearHood,
      });
      assert.equal(outfit.hairStyle, hair.id);
      assert.equal(outfit.gender, gender.id);
      assert.equal(outfit.bearHood, bearHood);
    }
assert.deepEqual(
  validateAppearance(undefined),
  options.defaults,
  'Older clients receive a full default outfit',
);
for (const character of options.characters) {
  const original = validateAppearance({ character: character.id });
  assert.equal(original.character, character.id);
  for (const [key, value] of Object.entries(
    options.characterColors[character.id],
  ))
    assert.equal(original[key], value);
}
const { character: _, ...legacy } = options.defaults;
assert.equal(
  validateAppearance(undefined, legacy).character,
  'bear',
  'Old saved visitors migrate to the original bear',
);
assert.equal(
  validateAppearance({ character: 'bear' }, saved).hairColor,
  options.characterColors.bear.hairColor,
);
console.log(
  'All registered characters, original-color defaults, legacy migration, custom colors, atomic seat saves, conflict isolation and invalid requests passed.',
);

const foxStore = createPresenceStore();
const fox = foxStore.mutate('192.0.2.30', {
  action: 'sit',
  name: '小狐',
  seatId: 'living-sofa-2',
  appearance: { character: 'fox' },
});
assert.equal(fox.visitors[0].appearance.character, 'fox');
assert.equal(
  fox.visitors[0].appearance.topColor,
  options.characterColors.fox.topColor,
);
assert.deepEqual(foxStore.snapshot('192.0.2.30').visitors[0], fox.visitors[0]);
