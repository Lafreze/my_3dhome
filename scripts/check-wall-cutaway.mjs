import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Object3D } from 'three';
// Run the production controller without a browser or a second copy of its geometry logic.
const source = stripTypeScriptTypes(
  await readFile(new URL('../app/wall-cutaway.ts', import.meta.url), 'utf8'),
  { mode: 'transform' },
).replace(
  "'./house-data'",
  JSON.stringify(new URL('../app/house-data.ts', import.meta.url).href),
);
const { createWallCutaways } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const controller = createWallCutaways(),
  west = new Object3D(),
  north = new Object3D(),
  shared = new Object3D(),
  cafe = new Object3D();
controller.add([west], { x: -3.91, z: 0, nx: 1, nz: 0 }, ['study']);
controller.add([north], { x: 0, z: -3.31, nx: 0, nz: 1 }, ['study']);
controller.add(
  [shared],
  { x: 4, z: 0, nx: 1, nz: 0 },
  ['study', 'living'],
  true,
);
controller.add([cafe], { x: 4, z: 18.11, nx: 0, nz: -1 }, ['cafe']);
controller.update('study', { x: 0, z: 4 });
assert(west.visible && north.visible && shared.visible);
controller.update('study', { x: -8, z: -8 });
assert(!west.visible && !north.visible);
controller.update('study', { x: 9, z: 4 });
assert(!shared.visible, 'Near shared wall must not obstruct study from east');
controller.update('living', { x: 9, z: 4 });
assert(
  shared.visible,
  'Same wall is the far interior wall when visiting living room',
);
controller.update('living', { x: 0, z: 4 });
assert(!shared.visible, 'Living west wall cuts away from its reverse side');
controller.update('cafe', { x: 4, z: 22 });
assert(!cafe.visible);
controller.update('cafe', { x: 4, z: 13 });
assert(cafe.visible);
controller.update('overview', { x: 20, z: 26 });
assert(!shared.visible && !cafe.visible);
controller.update('plan', { x: 4, z: 7 });
assert(!shared.visible && cafe.visible);
controller.update('study', { x: -3.8, z: 0 });
assert(west.visible);
controller.update('study', { x: -3.94, z: 0 });
assert(west.visible, 'Hysteresis should prevent edge flicker');
controller.update('study', { x: -4.1, z: 0 });
assert(!west.visible);
console.log(
  'Wall cutaways: exterior reversal, shared wall from both rooms, inactive rooms, plan, overview and edge hysteresis passed.',
);
