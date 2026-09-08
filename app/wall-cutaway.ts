import type { Object3D } from 'three';
import { rooms, type HouseView, type RoomId } from './house-data';

type Plane = { x: number; z: number; nx: number; nz: number };
type Wall = {
  objects: Object3D[];
  plane: Plane;
  neighbours: RoomId[];
  shared: boolean;
  visible: boolean;
};

// A small dead band prevents flicker when the camera rests exactly on a wall plane.
export function wallInteriorVisible(distance: number, previous: boolean) {
  return distance > (previous ? -0.08 : 0.08);
}
export function createWallCutaways() {
  const walls: Wall[] = [];
  return {
    add(
      objects: Object3D[],
      plane: Plane,
      neighbours: RoomId[],
      shared = false,
    ) {
      walls.push({ objects, plane, neighbours, shared, visible: true });
    },
    update(view: HouseView, camera: { x: number; z: number }) {
      let changed = false;
      for (const wall of walls) {
        const { plane: p, neighbours, shared } = wall;
        const all = view === 'plan' || view === 'overview';
        let visible = all || neighbours.includes(view as RoomId);
        if (visible) {
          if (view === 'plan') visible = !shared;
          else if (all && shared) visible = false;
          else {
            let side = 1;
            if (shared && !all) {
              const r = rooms[view as RoomId];
              side = Math.sign((r.x - p.x) * p.nx + (r.z - p.z) * p.nz) || 1;
            }
            const distance =
              ((camera.x - p.x) * p.nx + (camera.z - p.z) * p.nz) * side;
            visible = wallInteriorVisible(distance, wall.visible);
          }
        }
        if (wall.visible !== visible) changed = true;
        wall.visible = visible;
        for (const object of wall.objects) object.visible = visible;
      }
      return changed;
    },
  };
}
export type WallCutaways = ReturnType<typeof createWallCutaways>;
