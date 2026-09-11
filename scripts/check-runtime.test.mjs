import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import test from 'node:test';

test('production image includes every relative import of its server modules', () => {
  const dockerfile = readFileSync(
    new URL('../Dockerfile', import.meta.url),
    'utf8',
  );
  const copies = [
    ...dockerfile.matchAll(
      /COPY --from=build(?: --chown=\S+)? \/app\/(\S+) \.\/(\S+)/g,
    ),
  ];
  const packaged = new Set(copies.map((m) => m[2]));
  assert(packaged.has('scripts/serve-local.mjs'));
  for (const [, source, destination] of copies) {
    if (!destination.endsWith('.mjs')) continue;
    const contents = readFileSync(
      new URL('../' + source, import.meta.url),
      'utf8',
    );
    for (const match of contents.matchAll(
      /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g,
    )) {
      const dependency = posix.normalize(
        posix.join(dirname(destination), match[1]),
      );
      assert(
        packaged.has(dependency),
        `${destination} needs ${dependency} in the runtime image`,
      );
    }
  }
});
