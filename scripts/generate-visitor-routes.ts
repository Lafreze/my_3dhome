import { writeFileSync } from 'node:fs';
import { rooms, houseFurniture } from '../app/house-data.ts';
import { gameFurniture } from '../app/game-layout.ts';
import { layout } from '../app/room-layout.ts';
import { cafeChairs, cafeLayout } from '../app/cafe-layout.ts';
import seats from '../app/seat-catalog.json' with { type: 'json' };
import {
  NavigationGraph,
  floorClear,
  segmentClear,
  lifeObstacles,
} from '../app/life-navigation.ts';
import type { Point } from '../app/life-data.ts';
import type { RoomId } from '../app/house-data.ts';
const nav = new NavigationGraph();
const nodes: Record<string, { position: Point; yaw: number; approach: Point }> =
  {};
function parent(id: string): {
  x: number;
  z: number;
  yaw?: number;
  obstacle: string;
} {
  if (id === 'study-work') return { ...layout.stool, obstacle: 'stool' };
  if (id === 'study-reading') return { ...layout.chair, obstacle: 'chair' };
  if (id.startsWith('study-sofa')) return { ...layout.bed, obstacle: 'bed' };
  if (id.startsWith('gaming-sofa'))
    return { ...gameFurniture.sofa, yaw: Math.PI / 2, obstacle: 'sofa' };
  if (id === 'gaming-stool-1')
    return { ...gameFurniture.stoolA, obstacle: 'stoolA' };
  if (id === 'gaming-stool-2')
    return { ...gameFurniture.stoolB, obstacle: 'stoolB' };
  if (id.startsWith('living-sofa'))
    return { ...houseFurniture.living.sofa, yaw: Math.PI, obstacle: 'sofa' };
  if (id.startsWith('bedroom-bed'))
    return { ...houseFurniture.bedroom.bed, obstacle: 'bed' };
  if (id.startsWith('bedroom-bench'))
    return { ...houseFurniture.bedroom.bench, obstacle: 'bench' };
  if (id === 'bedroom-reading')
    return {
      ...houseFurniture.bedroom.readingChair,
      yaw: -Math.PI / 2,
      obstacle: 'readingChair',
    };
  if (id.startsWith('gallery-bench'))
    return { x: -0.1, z: 2.1, obstacle: 'bench' };
  if (id.startsWith('cafe-chair'))
    return {
      ...cafeChairs[Number(id.split('-')[2]) - 1],
      obstacle: `chair${Number(id.split('-')[2]) - 1}`,
    };
  return { ...cafeLayout.banquette, obstacle: 'banquette' };
}
function egressClear(a: Point, b: Point, room: RoomId, own: string) {
  for (let t = 0; t <= 1; t += 0.03) {
    const x = a[0] + (b[0] - a[0]) * t - rooms[room].x,
      z = a[2] + (b[2] - a[2]) * t - rooms[room].z;
    for (const f of lifeObstacles) {
      if (
        f.room !== room ||
        f.id === own ||
        (own === 'stool' && f.id === 'pulledChair')
      )
        continue;
      const dx = x - f.x,
        dz = z - f.z,
        c = Math.cos(f.yaw || 0),
        s = Math.sin(f.yaw || 0);
      const gap = Math.hypot(
        Math.max(0, Math.abs(dx * c - dz * s) - f.width / 2),
        Math.max(0, Math.abs(dx * s + dz * c) - f.depth / 2),
      );
      if (gap < 0.28) return false;
    }
  }
  return true;
}
for (const seat of seats) {
  const room = seat.room as RoomId,
    r = rooms[room],
    p = parent(seat.id),
    yaw = p.yaw || 0;
  const position: Point = [
    r.x + p.x + Math.cos(yaw) * seat.offset[0] + Math.sin(yaw) * seat.offset[2],
    seat.offset[1],
    r.z + p.z - Math.sin(yaw) * seat.offset[0] + Math.cos(yaw) * seat.offset[2],
  ];
  const candidates: { p: Point; score: number }[] = [];
  const bed = seat.id.startsWith('bedroom-bed');
  for (let radius = 0.6; radius <= 2; radius += 0.08)
    for (let i = 0; i < 32; i++) {
      const angle = yaw + seat.yaw + (i * Math.PI) / 16;
      // A backrest is solid. Access sofas and chairs from their open front,
      // never choose a shorter route through the rear of the furniture.
      if (seat.id.includes('sofa') && Math.cos((i * Math.PI) / 16) < 0.35)
        continue;
      const end: Point = [
        position[0] + Math.sin(angle) * radius,
        0.085,
        position[2] + Math.cos(angle) * radius,
      ];
      if (bed && Math.sign(end[0] - (r.x + p.x)) !== Math.sign(seat.offset[0]))
        continue;
      if (
        floorClear(end, 'resident', 0.33) &&
        egressClear(position, end, room, p.obstacle)
      )
        candidates.push({
          p: end,
          score: radius + 0.16 * (1 - Math.cos((i * Math.PI) / 16)),
        });
    }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length) throw Error('No safe egress: ' + seat.id);
  const connected = candidates.find((c) =>
    nav.path(c.p, [2.65, 0.085, 2.5], 'resident'),
  );
  if (!connected) throw Error('No connected egress: ' + seat.id);
  const approach = connected.p.map((n) => +n.toFixed(4)) as Point;
  nodes[seat.id] = {
    position: position.map((n) => +n.toFixed(4)) as Point,
    yaw: yaw + seat.yaw,
    approach,
  };
  console.log(seat.id, approach);
}
const routes: Record<string, Point[]> = {};
for (let a = 0; a < seats.length; a++)
  for (let b = a + 1; b < seats.length; b++) {
    const from = nodes[seats[a].id].approach,
      to = nodes[seats[b].id].approach;
    const route = nav.path(from, to, 'resident');
    if (!route) throw Error(`Disconnected ${seats[a].id} -> ${seats[b].id}`);
    const raw = [from, ...route],
      simple: Point[] = [from];
    for (let i = 0; i < raw.length - 1;) {
      let next = i + 1;
      for (let j = raw.length - 1; j > i + 1; j--)
        if (segmentClear(raw[i], raw[j], 'resident')) {
          next = j;
          break;
        }
      simple.push(raw[next].map((n) => +n.toFixed(4)) as Point);
      i = next;
    }
    routes[`${seats[a].id}|${seats[b].id}`] = simple;
  }
writeFileSync(
  'config/visitor-routes.json',
  JSON.stringify({ version: 1, nodes, routes }) + '\n',
);
console.log('Generated', Object.keys(routes).length, 'safe transfers');
