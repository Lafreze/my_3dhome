import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSettings } from './house-settings.mjs';
import { createCoffeeState, coffeeHeat } from '../app/coffee-state.ts';
const defaults = JSON.parse(
  readFileSync(new URL('../config/house-defaults.json', import.meta.url)),
);
test('all three study paintings accept approved R2 references, uploads and restore; arbitrary URLs and color payloads fail closed', () => {
  const settings = structuredClone(defaults);
  settings.wallArt = {
    studyArt1: 'asset:art.quiet-hills',
    studyArt2: 'asset:art.evening-window',
    studyArt3: 'asset:art.botanical-study',
  };
  settings.appearance.bed = '#507a62';
  assert.deepEqual(validateSettings(settings), settings);
  const upload =
    'data:image/webp;base64,' +
    readFileSync(
      new URL('../public/artwork/quiet-hills.webp', import.meta.url),
    ).toString('base64');
  assert.equal(
    validateSettings({ ...settings, wallArt: { studyArt2: upload } }).wallArt
      .studyArt2,
    upload,
  );
  for (const bad of [
    'asset:unlisted',
    'https://untrusted.test/a.jpg',
    'javascript:alert(1)',
  ]) {
    assert.throws(() =>
      validateSettings({ ...settings, wallArt: { studyArt1: bad } }),
    );
  }
  assert.throws(() =>
    validateSettings({
      ...settings,
      appearance: { ...settings.appearance, bed: 'red;script' },
    }),
  );
  assert.deepEqual(
    validateSettings({ ...settings, wallArt: { studyArt1: null } }).wallArt,
    {},
  );
  assert.equal(
    validateSettings(defaults).appearance.bed,
    defaults.appearance.bed,
  );
});
test('coffee finishes once, cools monotonically, survives inactivity and keeps the cup until cleared', () => {
  for (const drink of ['espresso', 'latte', 'filter']) {
    const events = [];
    const coffee = createCoffeeState((s) => events.push(s.phase));
    assert(coffee.start(drink));
    assert(!coffee.start('espresso'));
    coffee.update(2);
    assert.equal(coffee.snapshot().phase, 'extracting');
    coffee.update(6);
    assert.equal(coffee.snapshot().phase, 'ready');
    let previous = 1;
    for (let i = 0; i < 240; i++) {
      coffee.update(1);
      const heat = coffee.snapshot().heat;
      assert(heat <= previous);
      previous = heat;
    }
    assert.equal(previous, 0);
    assert.equal(coffee.snapshot().phase, 'ready');
    assert.deepEqual(events, ['grinding', 'extracting', 'ready']);
    const stable = coffee.snapshot();
    assert.deepEqual(coffee.snapshot(), stable);
    coffee.clear();
    assert.equal(coffee.snapshot().phase, 'empty');
    assert(coffee.start('latte'));
  }
  assert.equal(coffeeHeat(-10), 1);
  assert.equal(coffeeHeat(180), 0);
});

test('the runtime image includes every server settings dependency', async () => {
  const { mkdtemp, mkdir, copyFile, rm, symlink } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const root = new URL('../', import.meta.url);
  const dir = await mkdtemp(join(tmpdir(), 'kuro-runtime-'));
  try {
    const docker = readFileSync(new URL('Dockerfile', root), 'utf8');
    for (const line of docker.split('\n')) {
      const copy = line.match(
        /^COPY --from=build(?: --chown=node:node)? \/app\/(\S+) (\S+)/,
      );
      if (!copy || copy[1] === 'dist/client') continue;
      const to = join(dir, copy[2]);
      await mkdir(dirname(to), { recursive: true });
      if (copy[1] === 'node_modules') {
        const { fileURLToPath } = await import('node:url');
        await symlink(fileURLToPath(new URL('node_modules', root)), to, 'dir');
      } else await copyFile(new URL(copy[1], root), to);
    }
    const { createPresenceHandler } = await import(
      pathToFileURL(join(dir, 'scripts/seat-presence.mjs'))
    );
    assert.equal(typeof createPresenceHandler(), 'function');
    const { createHouseHandler } = await import(
      pathToFileURL(join(dir, 'scripts/house-settings.mjs'))
    );
    assert.equal(
      typeof (await createHouseHandler({
        dataDir: join(dir, 'data'),
        password: 'test',
      })),
      'function',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
