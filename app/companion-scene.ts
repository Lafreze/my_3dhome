import { companionDestinations } from './companion-routes';
import rigSpecs from '../config/character-rigs.json';
import * as T from 'three';
import {
  acquireRiggedCharacter,
  type RiggedCharacter,
} from './rigged-character';
import {
  NavigationGraph,
  walkingStepClear,
  type OccupancyManager,
} from './life-navigation';
import { type Point } from './life-data';
import { roomAt, type RoomId } from './house-data';
import type { RoomAssets } from './asset-loading';

/** Both companions share the house collision map and live actor occupancy. */
export function createCompanions(
  scene: T.Scene,
  occupancy: OccupancyManager,
  assets: RoomAssets,
) {
  let disposed = false,
    clock = 0;
  const graph = new NavigationGraph();
  const pets = (['shiba', 'capybara'] as const).map((id, index) => ({
    id,
    room: (index ? 'garden' : 'cafe') as RoomId,
    rig: undefined as RiggedCharacter | undefined,
    position: undefined as Point | undefined,
    path: [] as Point[],
    distance: 0,
    speed: 0,
    yaw: 0,
    wait: 2 + index * 3,
    goal: 0,
    walk: 0,
    blocked: 0,
  }));
  for (const pet of pets)
    void assets.register(pet.room, `character.rigged.${pet.id}`, async () => {
      const rig = await acquireRiggedCharacter(pet.id);
      if (disposed) {
        rig.dispose();
        return;
      }
      pet.rig = rig;
      scene.add(rig.root);
      rig.root.visible = false;
    })();

  return {
    update(
      dt: number,
      reduced: boolean,
      paused: boolean,
      visible: (room: RoomId) => boolean,
    ) {
      dt = Math.min(dt, 0.05);
      if (!paused) clock += dt;
      for (const pet of pets) {
        if (!pet.rig) continue;
        const goals = companionDestinations(pet.id);
        if (!pet.position) {
          const start = goals.find((p) => occupancy.clear(p, pet.id));
          if (!start) continue;
          pet.position = [...start];
          occupancy.actors.set(pet.id, {
            position: pet.position,
            radius: rigSpecs[pet.id].radius,
            active: true,
          });
        }
        const shown = visible(
          roomAt(pet.position[0], pet.position[2]) ?? pet.room,
        );
        pet.rig.root.visible = shown;
        if (!paused && !reduced) {
          pet.wait -= dt;
          if (!pet.path.length && pet.wait <= 0) {
            for (let tries = 0; tries < goals.length; tries++) {
              const target = goals[++pet.goal % goals.length];
              if (
                Math.hypot(
                  target[0] - pet.position[0],
                  target[2] - pet.position[2],
                ) < 0.6
              )
                continue;
              const path = graph.path(pet.position, target, pet.id, occupancy);
              if (path) {
                pet.path = path;
                break;
              }
            }
            pet.wait = 8;
          }
          while (
            pet.path.length > 1 &&
            walkingStepClear(pet.position, pet.path[1], pet.id) &&
            graph.segmentFree(pet.position, pet.path[1], pet.id, occupancy)
          )
            pet.path.shift();
          const target = pet.path[0];
          const remaining = target
            ? Math.hypot(
                target[0] - pet.position[0],
                target[2] - pet.position[2],
              )
            : 0;
          const cruise = pet.id === 'shiba' ? 0.23 : 0.16;
          const desired = target
            ? pet.path.length > 1
              ? cruise
              : Math.min(cruise, Math.sqrt(2 * 0.45 * remaining))
            : 0;
          pet.speed = T.MathUtils.damp(pet.speed, desired, 6, dt);
          let moved = 0;
          if (target && remaining > 0.00001) {
            const step = Math.min(remaining, pet.speed * dt),
              dx = ((target[0] - pet.position[0]) / remaining) * step,
              dz = ((target[2] - pet.position[2]) / remaining) * step;
            const next: Point = [
              pet.position[0] + dx,
              0.085,
              pet.position[2] + dz,
            ];
            if (
              walkingStepClear(pet.position, next, pet.id) &&
              occupancy.clearMovement(pet.position, next, pet.id)
            ) {
              pet.position = next;
              pet.distance += step;
              moved = step;
              pet.blocked = 0;
              const yaw = Math.atan2(dx, dz);
              pet.yaw +=
                Math.atan2(Math.sin(yaw - pet.yaw), Math.cos(yaw - pet.yaw)) *
                (1 - Math.exp(-dt * 9));
              if (remaining - step < 0.008) {
                pet.path.shift();
                if (!pet.path.length) pet.wait = 10 + (pet.goal % 3) * 5;
              }
            } else {
              pet.speed = 0;
              pet.blocked += dt;
              if (pet.blocked > 1) {
                pet.path = [];
                pet.wait = 2;
                pet.blocked = 0;
              }
            }
          }
          pet.walk = T.MathUtils.damp(pet.walk, moved > 0 ? 1 : 0, 10, dt);
        } else pet.walk = T.MathUtils.damp(pet.walk, 0, 10, dt);
        occupancy.actors.set(pet.id, {
          position: pet.position,
          radius: rigSpecs[pet.id].radius,
          active: true,
        });
        pet.rig.root.position.fromArray(pet.position);
        pet.rig.root.rotation.y = pet.yaw;
        if (shown)
          pet.rig.pose({
            time: clock,
            distance: pet.distance,
            walk: pet.walk,
            reduced,
          });
      }
    },
    hasVisibleTravel: () =>
      pets.some((p) => p.rig?.root.visible && p.path.length > 0),
    snapshot: () =>
      pets.map((p) => ({
        id: p.id,
        position: p.position,
        path: p.path,
        loaded: !!p.rig,
        visible: p.rig?.root.visible,
        distance: p.distance,
      })),
    dispose() {
      disposed = true;
      for (const p of pets) {
        p.rig?.dispose();
        occupancy.actors.delete(p.id);
      }
    },
  };
}
