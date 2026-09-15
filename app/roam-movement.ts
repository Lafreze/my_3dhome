import { floorClear, worldPoint } from './life-navigation.ts';
import { navigationNodes, type Point } from './life-data.ts';
import { roomAt, rooms, type RoomId } from './house-data.ts';
export function roamSpawn(room: RoomId, near?: Point): Point {
  const center: Point = near ?? [rooms[room].x, 0.085, rooms[room].z];
  const nodes = navigationNodes
    .filter((n) => n.room === room && n.allowedActors.includes('resident'))
    .map(worldPoint)
    .filter((p) => floorClear(p, 'resident', 0.31));
  nodes.sort(
    (a, b) =>
      Math.hypot(a[0] - center[0], a[2] - center[2]) -
      Math.hypot(b[0] - center[0], b[2] - center[2]),
  );
  if (nodes[0]) return [...nodes[0]];
  const r = rooms[room];
  let best: Point | undefined,
    score = Infinity;
  for (let x = r.x - r.width / 2 + 0.5; x < r.x + r.width / 2 - 0.4; x += 0.2)
    for (
      let z = r.z - r.depth / 2 + 0.5;
      z < r.z + r.depth / 2 - 0.4;
      z += 0.2
    ) {
      const p: Point = [x, 0.085, z],
        d = Math.hypot(x - center[0], z - center[2]);
      if (d < score && floorClear(p, 'resident', 0.34)) {
        best = p;
        score = d;
      }
    }
  if (best) return best;
  throw Error(`No walking entrance for ${room}`);
}
export function moveRoamer(
  position: Point,
  input: [number, number],
  dt: number,
  occupied: Point[] = [],
): Point {
  const length = Math.hypot(...input);
  if (!length || !Number.isFinite(length) || !Number.isFinite(dt))
    return [...position];
  const scale = (1.35 * Math.max(0, Math.min(dt, 0.05))) / Math.max(1, length);
  const dx = input[0] * scale,
    dz = input[1] * scale;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.025));
  let p = [...position] as Point;
  const clear = (v: Point) =>
    floorClear(v, 'resident', 0.31) &&
    occupied.every((o) => Math.hypot(o[0] - v[0], o[2] - v[2]) > 0.62);
  for (let i = 0; i < steps; i++) {
    const next: Point = [p[0] + dx / steps, 0.085, p[2] + dz / steps];
    if (clear(next)) p = next;
    else if (clear([next[0], 0.085, p[2]])) p[0] = next[0];
    else if (clear([p[0], 0.085, next[2]])) p[2] = next[2];
  }
  return roomAt(p[0], p[2]) ? p : position;
}
