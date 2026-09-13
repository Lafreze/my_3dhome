import {
  rooms,
  roomAt,
  houseBounds,
  houseFurniture,
  type RoomId,
} from './house-data.ts';
import { layout, workChairTravel, drawerTravel } from './room-layout.ts';
import { gardenFurniture } from './garden-layout.ts';
import { libraryFurniture, libraryLadderLane } from './library-layout.ts';
import { barFurniture, barStools, barDartLane } from './bar-layout.ts';
import { gameFurniture, expansionPortals } from './game-layout.ts';
import {
  cafeLayout,
  cafeChairs,
  cafeBistroTables,
  cafeFloorPlants,
} from './cafe-layout.ts';
import {
  navigationNodes,
  actorSpecs,
  type ActorId,
  type Point,
  type NavigationNode,
} from './life-data.ts';

type Footprint = {
  x: number;
  z: number;
  width: number;
  depth: number;
  yaw?: number;
};
export type Obstacle = Footprint & { room: RoomId; id: string };
export const lifeObstacles: Obstacle[] = [
  ...Object.entries(gardenFurniture).map(([id, f]) => ({
    ...f,
    id,
    room: 'garden' as const,
  })),
  ...Object.entries(libraryFurniture).map(([id, f]) => ({
    ...f,
    id,
    room: 'library' as const,
  })),
  { ...libraryLadderLane, id: 'ladderLane', room: 'library' },
  ...Object.entries(barFurniture).map(([id, f]) => ({
    ...f,
    id,
    room: 'bar' as const,
  })),
  ...barStools.map((f) => ({ ...f, room: 'bar' as const })),
  { ...barDartLane, id: 'dartLane', room: 'bar' },
  ...Object.entries(gameFurniture).map(([id, f]) => ({
    ...f,
    id,
    room: 'gaming' as const,
  })),
  ...Object.entries(layout).map(([id, f]) => ({
    ...f,
    id,
    room: 'study' as const,
  })),
  // Reserve the complete swept volume of the chair, drawer and wardrobe doors.
  {
    room: 'study',
    id: 'pulledChair',
    ...layout.stool,
    z: layout.stool.z + workChairTravel,
  },
  {
    room: 'study',
    id: 'drawer',
    x: layout.desk.x + 0.9,
    z: layout.desk.z + drawerTravel + 0.04,
    width: 0.55,
    depth: 0.69,
  },
  ...Object.entries(houseFurniture).flatMap(([room, items]) =>
    Object.entries(items).map(([id, f]) => ({
      ...f,
      id,
      room: room as RoomId,
    })),
  ),
  {
    room: 'bedroom',
    id: 'wardrobeSwing',
    x: 2.45,
    z: -0.25,
    width: 1.35,
    depth: 2.55,
  },
  { room: 'gallery', id: 'plant', x: -3.1, z: 2.78, width: 0.7, depth: 0.7 },
  ...Object.entries(cafeLayout).map(([id, f]) => ({
    ...f,
    id,
    room: 'cafe' as const,
  })),
  ...cafeChairs.map((f, i) => ({
    ...f,
    width: f.style === 'lounge' ? 1.12 : 0.76,
    depth: f.style === 'lounge' ? 1.15 : 0.85,
    id: `chair${i}`,
    room: 'cafe' as const,
  })),
  ...cafeBistroTables.map((f, i) => ({
    ...f,
    id: `table${i}`,
    room: 'cafe' as const,
  })),
  ...Object.entries(cafeFloorPlants).map(([id, f]) => ({
    ...f,
    id,
    room: 'cafe' as const,
  })),
];
// Existing 1.4-unit openings; the tuples describe the wall normal and portal centre.
export const lifePortals = [
  ...expansionPortals,
  { axis: 'x', at: 4, along: 1.75, a: 'study', b: 'living' },
  { axis: 'x', at: 4, along: 8.65, a: 'bedroom', b: 'gallery' },
  { axis: 'z', at: 3.4, along: 2.65, a: 'study', b: 'bedroom' },
  { axis: 'z', at: 3.4, along: 5.6, a: 'living', b: 'gallery' },
  { axis: 'z', at: 10.2, along: 2.65, a: 'bedroom', b: 'cafe' },
  { axis: 'z', at: 10.2, along: 9.6, a: 'gallery', b: 'cafe' },
] as const;
export function worldPoint(n: NavigationNode): Point {
  return [
    n.position[0] + rooms[n.room].x,
    n.position[1],
    n.position[2] + rooms[n.room].z,
  ];
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]);
function rectDistance(x: number, z: number, f: Footprint) {
  const dx = x - f.x,
    dz = z - f.z,
    c = Math.cos(f.yaw || 0),
    s = Math.sin(f.yaw || 0);
  return Math.hypot(
    Math.max(0, Math.abs(dx * c - dz * s) - f.width / 2),
    Math.max(0, Math.abs(dx * s + dz * c) - f.depth / 2),
  );
}
const actorRoom = (actor: ActorId, room: RoomId) =>
  actor !== 'robot' || ['cafe', 'gallery', 'living'].includes(room);
export function floorClear(
  p: Point,
  actor: ActorId,
  radius: number = actorSpecs[actor].radius,
): boolean {
  const room = roomAt(p[0], p[2]);
  if (!room || !actorRoom(actor, room)) return false;
  const r = rooms[room],
    x = p[0] - r.x,
    z = p[2] - r.z;
  for (const edge of [
    { axis: 'x', at: r.x - r.width / 2, delta: x + r.width / 2 },
    { axis: 'x', at: r.x + r.width / 2, delta: r.width / 2 - x },
    { axis: 'z', at: r.z - r.depth / 2, delta: z + r.depth / 2 },
    { axis: 'z', at: r.z + r.depth / 2, delta: r.depth / 2 - z },
  ]) {
    if (edge.delta >= radius + 0.12) continue;
    if (
      !lifePortals.some(
        (portal) =>
          portal.axis === edge.axis &&
          Math.abs(portal.at - edge.at) < 0.01 &&
          (portal.a === room || portal.b === room) &&
          actorRoom(actor, portal.a) &&
          actorRoom(actor, portal.b) &&
          Math.abs((edge.axis === 'x' ? p[2] : p[0]) - portal.along) <
            0.7 - radius - 0.07,
      )
    )
      return false;
  }
  if (actor === 'robot' && room === 'cafe' && x < -1.65 && z < -1.7)
    return false;
  for (const f of lifeObstacles) {
    if (f.room !== room) continue;
    // Rabbit fits below the gallery bench; all other furniture is solid for navigation.
    if (actor === 'rabbit' && room === 'gallery' && f.id === 'bench') continue;
    if (rectDistance(x, z, f) < radius + 0.035) return false;
  }
  return true;
}
export function segmentClear(a: Point, b: Point, actor: ActorId): boolean {
  const count = Math.max(1, Math.ceil(distance(a, b) / 0.04));
  // Additional clearance covers the continuous swept circle between discrete samples.
  for (let i = 0; i <= count; i++)
    if (
      !floorClear(
        [
          a[0] + ((b[0] - a[0]) * i) / count,
          0.085,
          a[2] + ((b[2] - a[2]) * i) / count,
        ],
        actor,
        actorSpecs[actor].radius + 0.025,
      )
    )
      return false;
  return true;
}
export class OccupancyManager {
  reservations = new Map<string, ActorId>();
  visitors = new Map<string, { seatId: string; position: Point }>();
  actors = new Map<
    ActorId,
    { position: Point; radius: number; active: boolean }
  >();
  setVisitors(people: { id: string; seatId: string; position: Point }[]) {
    this.visitors = new Map(people.map((v) => [v.id, v]));
  }
  seatOccupied(id?: string) {
    return !!id && [...this.visitors.values()].some((v) => v.seatId === id);
  }
  available(node: NavigationNode, actor: ActorId) {
    const owner = this.reservations.get(node.id);
    return (
      !this.seatOccupied(node.seatId) &&
      (!owner || owner === actor) &&
      this.clear(worldPoint(node), actor)
    );
  }
  reserve(node: NavigationNode, actor: ActorId) {
    if (!this.available(node, actor)) return false;
    this.release(actor);
    this.reservations.set(node.id, actor);
    node.occupancy = actor;
    return true;
  }
  release(actor: ActorId) {
    for (const [id, a] of this.reservations)
      if (a === actor) {
        this.reservations.delete(id);
        const n = navigationNodes.find((n) => n.id === id);
        if (n) n.occupancy = null;
      }
  }
  clear(p: Point, actor: ActorId, extra = 0) {
    const radius = actorSpecs[actor].radius + extra;
    for (const v of this.visitors.values())
      if (distance(p, v.position) < radius + 0.34) return false;
    for (const [id, a] of this.actors)
      if (
        id !== actor &&
        a.active &&
        distance(p, a.position) < radius + a.radius + 0.05
      )
        return false;
    return true;
  }
}
/** Deterministic walkable lattice between named goals. Edges are sampled, so diagonals never cut corners. */
export class NavigationGraph {
  private graphs = new Map<ActorId, Map<string, Point>>();
  private step = 0.14;
  private key(x: number, z: number) {
    return `${x},${z}`;
  }
  private graph(actor: ActorId) {
    let graph = this.graphs.get(actor);
    if (graph) return graph;
    graph = new Map();
    for (
      let x = Math.ceil(houseBounds.minX / this.step);
      x <= Math.floor(houseBounds.maxX / this.step);
      x++
    )
      for (
        let z = Math.ceil(houseBounds.minZ / this.step);
        z <= Math.floor(houseBounds.maxZ / this.step);
        z++
      ) {
        const p: Point = [x * this.step, 0.085, z * this.step];
        if (floorClear(p, actor)) graph.set(this.key(x, z), p);
      }
    this.graphs.set(actor, graph);
    return graph;
  }
  path(
    from: Point,
    to: Point,
    actor: ActorId,
    occupancy?: OccupancyManager,
  ): Point[] | null {
    if (!floorClear(from, actor) || !floorClear(to, actor)) return null;
    if (
      segmentClear(from, to, actor) &&
      (!occupancy || this.segmentFree(from, to, actor, occupancy))
    )
      return [to];
    const grid = this.graph(actor),
      near = (p: Point) =>
        [...grid.entries()]
          .filter(
            ([, v]) =>
              distance(p, v) < 0.65 &&
              segmentClear(p, v, actor) &&
              (!occupancy || this.segmentFree(p, v, actor, occupancy)),
          )
          .sort((a, b) => distance(p, a[1]) - distance(p, b[1]))[0]?.[0];
    const start = near(from),
      end = near(to);
    if (!start || !end) return null;
    const open = new Set([start]),
      cost = new Map([[start, 0]]),
      prev = new Map<string, string>();
    let iterations = 0;
    while (open.size && iterations++ < 16000) {
      let current = '',
        best = Infinity;
      for (const id of open) {
        const score = cost.get(id)! + distance(grid.get(id)!, to);
        if (score < best) {
          best = score;
          current = id;
        }
      }
      if (current === end) {
        const result: Point[] = [to];
        let id = end;
        while (id !== start) {
          result.unshift(grid.get(id)!);
          id = prev.get(id)!;
        }
        result.unshift(grid.get(start)!);
        return result;
      }
      open.delete(current);
      const [x, z] = current.split(',').map(Number),
        p = grid.get(current)!;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const key = this.key(x + dx, z + dz),
          next = grid.get(key);
        if (
          !next ||
          !segmentClear(p, next, actor) ||
          (occupancy && !this.segmentFree(p, next, actor, occupancy))
        )
          continue;
        const d = cost.get(current)! + distance(p, next);
        if (d >= (cost.get(key) ?? Infinity)) continue;
        cost.set(key, d);
        prev.set(key, current);
        open.add(key);
      }
    }
    return null;
  }
  segmentFree(a: Point, b: Point, actor: ActorId, occupancy: OccupancyManager) {
    const count = Math.max(1, Math.ceil(distance(a, b) / 0.1));
    for (let i = 1; i <= count; i++)
      if (
        !occupancy.clear(
          [
            a[0] + ((b[0] - a[0]) * i) / count,
            0.085,
            a[2] + ((b[2] - a[2]) * i) / count,
          ],
          actor,
          0.015,
        )
      )
        return false;
    return true;
  }
}
