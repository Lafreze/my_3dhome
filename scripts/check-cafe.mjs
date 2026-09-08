import assert from 'node:assert/strict';
import { rooms, roomAt, houseBounds } from '../app/house-data.ts';
import {
  cafeLayout,
  cafeBistroTables,
  cafeChairs,
  cafeRoutes,
  cafeCounterItems,
  cafeFloorPlants,
} from '../app/cafe-layout.ts';
const footprint = (f) => ({
  x0: f.x - f.width / 2,
  x1: f.x + f.width / 2,
  z0: f.z - f.depth / 2,
  z1: f.z + f.depth / 2,
});
const items = Object.entries(cafeLayout).map(([id, f]) => ({ id, ...f }));
Object.entries(cafeFloorPlants).forEach(([id, f]) =>
  items.push({ id: `plant ${id}`, ...f }),
);
cafeBistroTables.forEach((f, i) => items.push({ id: `bistro ${i + 1}`, ...f }));
cafeChairs.forEach((c, i) =>
  items.push({
    id: `chair ${i + 1}`,
    x: c.x,
    z: c.z,
    width: c.style === 'lounge' ? 1.06 : 0.74,
    depth: c.style === 'lounge' ? 1.1 : 0.74,
  }),
);
for (const f of items) {
  const b = footprint(f);
  assert(
    b.x0 >= -7.85 && b.x1 <= 7.85 && b.z0 >= -3.85 && b.z1 <= 3.85,
    `${f.id} crosses a wall`,
  );
}
for (let i = 0; i < items.length; i++)
  for (let j = i + 1; j < items.length; j++) {
    const a = footprint(items[i]),
      b = footprint(items[j]);
    assert(
      !(
        a.x0 < b.x1 - 0.001 &&
        a.x1 > b.x0 + 0.001 &&
        a.z0 < b.z1 - 0.001 &&
        a.z1 > b.z0 + 0.001
      ),
      `${items[i].id} intersects ${items[j].id}`,
    );
  }
for (const c of cafeChairs) {
  const dx = c.table[0] - c.x,
    dz = c.table[1] - c.z;
  assert(
    (-Math.sin(c.yaw) * dx - Math.cos(c.yaw) * dz) / Math.hypot(dx, dz) > 0.98,
    'Chair must face its table',
  );
}
for (const route of cafeRoutes)
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 100);
    for (let j = 0; j <= steps; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / steps,
        z = a[1] + ((b[1] - a[1]) * j) / steps;
      for (const f of items) {
        const r = footprint(f),
          dx = Math.max(r.x0 - x, 0, x - r.x1),
          dz = Math.max(r.z0 - z, 0, z - r.z1);
        assert(
          Math.hypot(dx, dz) >= 0.42,
          `Walking route blocked by ${f.id} at ${x.toFixed(2)},${z.toFixed(2)}`,
        );
      }
    }
  }
assert(
  Math.abs(
    rooms.cafe.z -
      rooms.cafe.depth / 2 -
      (rooms.bedroom.z + rooms.bedroom.depth / 2),
  ) < 1e-6,
  'Cafe must directly join the south of the existing house',
);
assert.equal(rooms.cafe.width, rooms.bedroom.width + rooms.gallery.width);
assert.equal(roomAt(0, 14), 'cafe');
assert.equal(roomAt(11, 17), 'cafe');
assert.equal(roomAt(0, 20), undefined);
assert.equal(houseBounds.maxZ, 18.2);
// Display glass and checkout previously occupied the same volume. Keep all counter appliances separated.
const countertop = footprint(cafeLayout.counter);
const appliances = Object.entries(cafeCounterItems);
for (const [id, item] of appliances) {
  const b = footprint(item);
  assert(
    b.x0 >= countertop.x0 - 0.035 &&
      b.x1 <= countertop.x1 + 0.035 &&
      b.z0 >= countertop.z0 - 0.035 &&
      b.z1 <= countertop.z1 + 0.035,
    `${id} overhangs the counter`,
  );
}
for (let i = 0; i < appliances.length; i++)
  for (let j = i + 1; j < appliances.length; j++) {
    const a = footprint(appliances[i][1]),
      b = footprint(appliances[j][1]);
    assert(
      a.x1 + 0.015 <= b.x0 ||
        b.x1 + 0.015 <= a.x0 ||
        a.z1 + 0.015 <= b.z0 ||
        b.z1 + 0.015 <= a.z0,
      `${appliances[i][0]} intersects ${appliances[j][0]}`,
    );
  }
console.log(
  `${items.length} furniture and plant footprints: no overlaps; 7 counter appliances separated; 9 chairs face tables; 4 clear walking routes; south extension and plan picking passed.`,
);
