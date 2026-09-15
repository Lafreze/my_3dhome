import * as T from 'three';
import { acquireVisitorModel, configureVisitorTint } from './visitor-model';
import { appearanceStorageKey, readAppearance } from './visitor-appearance';
import {
  configureVisitorMotion,
  sampleVisitorMotion,
  visitorShadowMaterials,
} from './visitor-motion';
import { humanScale } from './character-scale.mjs';
import { footLift } from './visitor-travel.mjs';
import { moveRoamer, roamSpawn } from './roam-movement';
import { roomAt, roomForObject, type RoomId } from './house-data';
import { objects, type ObjectId } from './room-data';
import { houseDoorLayout } from './house-door-layout';
import type { Point, ActorId } from './life-data';
import type { SeatAnchors } from './seat-scene';
import { seatById } from './seat-data';
export type RoamTarget = {
  id: string;
  label: string;
  kind: 'object' | 'actor' | 'seat';
};
type Actor = { position: Point; room: string; active: boolean };
export function createRoamScene(
  scene: T.Scene,
  groups: Map<ObjectId, T.Group>,
  anchors: SeatAnchors,
  hooks: {
    room: (room: RoomId) => void;
    target: (target: RoamTarget | null) => void;
    activate: (target: RoamTarget) => void;
    bubble: (text: string) => void;
    door: (id: ObjectId) => void;
    actors: () => Partial<Record<ActorId, Actor>>;
  },
) {
  const root = new T.Group();
  root.name = 'Your roaming visitor';
  root.visible = false;
  scene.add(root);
  let enabled = false,
    disposed = false,
    room: RoomId = 'study',
    position = roamSpawn(room),
    input: [number, number] = [0, 0];
  let target: RoamTarget | null = null,
    targetKey = '',
    scan = 0,
    gait = 0,
    loaded = false,
    loading = false;
  let release: (() => void) | undefined;
  const materials: T.Material[] = [],
    geometries: T.BufferGeometry[] = [];
  const animated: {
    motion: T.InstancedBufferAttribute;
    action: T.InstancedBufferAttribute;
  }[] = [];
  let appearance = readAppearance(null);
  const state = { value: new T.Vector4() };
  function clearModel() {
    root.clear();
    materials.splice(0).forEach((m) => m.dispose());
    geometries.splice(0).forEach((g) => g.dispose());
    animated.length = 0;
    release?.();
    release = undefined;
    loaded = false;
  }
  async function load() {
    if (loading) return;
    let nextAppearance = readAppearance(null);
    try {
      nextAppearance = readAppearance(
        JSON.parse(localStorage.getItem(appearanceStorageKey) || 'null'),
      );
    } catch {
      /* Default outfit. */
    }
    if (loaded && JSON.stringify(nextAppearance) === JSON.stringify(appearance))
      return;
    clearModel();
    appearance = nextAppearance;
    target = null;
    targetKey = '';
    hooks.target(null);
    loading = true;
    try {
      const model = await acquireVisitorModel([appearance.character]);
      if (disposed) {
        model.release();
        return;
      }
      release = model.release;
      for (const part of model.parts.filter((p) => p.pose === 'sit')) {
        const geometry = new T.BufferGeometry();
        geometry.index = part.geometry.index;
        geometry.groups = part.geometry.groups.map((group) => ({ ...group }));
        for (const [name, attribute] of Object.entries(
          part.geometry.attributes,
        ))
          geometry.setAttribute(name, attribute);
        const motion = new T.InstancedBufferAttribute(new Float32Array(4), 4);
        const action = new T.InstancedBufferAttribute(
          new Float32Array([1, 0, 0, 0]),
          4,
        );
        geometry.setAttribute('visitorInstanceMotion', motion);
        geometry.setAttribute('visitorInstanceActivity', action);
        geometry.setAttribute(
          'visitorInstanceRest',
          new T.InstancedBufferAttribute(new Float32Array(1), 1),
        );
        const material = (
          Array.isArray(part.material) ? part.material : [part.material]
        ).map((m) => {
          const clone = m.clone();
          if (part.tint) configureVisitorTint(clone, part.character, part.tint);
          configureVisitorMotion(
            clone,
            part.character,
            state,
            true,
            part.eyelid,
          );
          materials.push(clone);
          return clone;
        });
        const mesh = new T.InstancedMesh(
          geometry,
          material.length === 1 ? material[0] : material,
          1,
        );
        mesh.setMatrixAt(0, new T.Matrix4());
        if (part.tint) mesh.setColorAt(0, new T.Color(appearance[part.tint]));
        const shadows = visitorShadowMaterials(
          part.character,
          state,
          true,
          !!part.eyelid,
        );
        mesh.customDepthMaterial = shadows.depth;
        mesh.customDistanceMaterial = shadows.distance;
        materials.push(shadows.depth, shadows.distance);
        geometries.push(geometry);
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
        animated.push({ motion, action });
      }
      root.scale.setScalar(humanScale(appearance.character));
      loaded = true;
    } catch {
      hooks.bubble('角色暂时没有准备好，请切回浏览后重试漫游。');
    } finally {
      loading = false;
    }
  }
  function findTarget() {
    if (!loaded) return;
    const candidates: { target: RoamTarget; distance: number }[] = [];
    const add = (
      id: string,
      label: string,
      kind: RoamTarget['kind'],
      x: number,
      z: number,
      range = 1.5,
    ) => {
      const d = Math.hypot(x - position[0], z - position[2]);
      if (d > range) return;
      // Facing and hysteresis keep adjacent tabletop objects from flickering.
      const facing =
        d > 0.1
          ? ((x - position[0]) * Math.sin(root.rotation.y) +
              (z - position[2]) * Math.cos(root.rotation.y)) /
            d
          : 1;
      candidates.push({
        target: { id, label, kind },
        distance: d + (1 - facing) * 0.35 - (target?.id === id ? 0.16 : 0),
      });
    };
    for (const [id, actor] of Object.entries(hooks.actors()))
      if (actor.active && actor.room === room)
        add(
          id,
          id === 'resident'
            ? '和主理人聊聊'
            : id === 'cat'
              ? '和小黑猫打招呼'
              : id === 'rabbit'
                ? '看看白兔'
                : '打个招呼',
          'actor',
          actor.position[0],
          actor.position[2],
          2,
        );
    for (const [id, group] of groups) {
      if (
        !(id in objects) ||
        ['floor', 'wall', 'rug'].includes(id) ||
        houseDoorLayout.some((d) => d.id === id || d.other === id) ||
        roomForObject(id) !== room
      )
        continue;
      // Use the object's own origin, avoiding a room-wide parent bounding box.
      const point = group.getWorldPosition(new T.Vector3());
      add(id, objects[id].name, 'object', point.x, point.z, 1.9);
    }
    for (const [id, anchor] of anchors) {
      const seat = seatById.get(id)!;
      if (seat.room !== room) continue;
      const p = anchor.getWorldPosition(new T.Vector3());
      add(
        id,
        seat.kind === 'bed' ? '躺下休息' : `坐在${seat.name}`,
        'seat',
        p.x,
        p.z,
        1.25,
      );
    }
    candidates.sort((a, b) => a.distance - b.distance);
    target = candidates[0]?.target ?? null;
    const key = target ? `${target.kind}:${target.id}` : '';
    if (key !== targetKey) {
      targetKey = key;
      hooks.target(target);
    }
  }
  return {
    get enabled() {
      return enabled;
    },
    get position() {
      return position;
    },
    enable(value: boolean, nextRoom: RoomId) {
      enabled = value;
      input = [0, 0];
      root.visible = value;
      if (value) {
        room = nextRoom;
        position = roamSpawn(room);
        void load();
      } else {
        target = null;
        targetKey = '';
        hooks.target(null);
      }
    },
    enterRoom(next: RoomId) {
      if (roomAt(position[0], position[2]) !== next) position = roamSpawn(next);
      room = next;
      scan = 0;
    },
    input(x: number, z: number) {
      input = [x, z];
    },
    interact() {
      if (enabled && loaded) {
        input = [0, 0];
        findTarget();
        if (target) hooks.activate(target);
      }
    },
    update(dt: number, time: number, paused: boolean, reduced: boolean) {
      if (!enabled) return;
      root.visible = loaded;
      const before = position;
      if (!paused && loaded)
        position = moveRoamer(
          position,
          input,
          dt,
          Object.values(hooks.actors())
            .filter((a) => a.active)
            .map((a) => a.position),
        );
      const dx = position[0] - before[0],
        dz = position[2] - before[2],
        distance = Math.hypot(dx, dz);
      if (distance > 0.0001) {
        const yaw = Math.atan2(dx, dz);
        root.rotation.y +=
          Math.atan2(
            Math.sin(yaw - root.rotation.y),
            Math.cos(yaw - root.rotation.y),
          ) *
          (1 - Math.exp(-dt * 14));
        gait += (distance / 0.36) * Math.PI * 2;
      }
      root.position.set(
        position[0],
        position[1] +
          footLift[appearance.character] * humanScale(appearance.character),
        position[2],
      );
      sampleVisitorMotion(time, 731, reduced, state.value);
      for (const a of animated) {
        a.motion.setXYZW(
          0,
          state.value.x,
          state.value.y,
          state.value.z,
          state.value.w,
        );
        a.action.setXY(0, 1, distance > 0.0001 && !reduced ? gait : 0);
        a.motion.needsUpdate = a.action.needsUpdate = true;
      }
      const next = roomAt(position[0], position[2]);
      if (next && next !== room) {
        room = next;
        hooks.room(next);
      }
      for (const door of houseDoorLayout)
        if (Math.hypot(position[0] - door.x, position[2] - door.z) < 1.5)
          hooks.door(door.id as ObjectId);
      scan -= dt;
      if (scan <= 0) {
        scan = 0.18;
        findTarget();
      }
    },
    follow(
      camera: T.PerspectiveCamera,
      look: T.Vector3,
      dt: number,
      reduced: boolean,
    ) {
      const desired = new T.Vector3(position[0], 0.8, position[2]);
      const factor = reduced ? 1 : 1 - Math.exp(-dt * 5);
      look.lerp(desired, factor);
      // Gameplay keeps a readable character size instead of fitting the whole room into portrait.
      const fov = camera.aspect < 0.85 ? 48 : 42;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const offset = new T.Vector3(0, 6.5, 8.8);
      camera.position.lerp(look.clone().add(offset), factor);
      camera.lookAt(look);
    },
    snapshot: () => ({
      enabled,
      loaded,
      room,
      position: [...position],
      target,
    }),
    dispose() {
      disposed = true;
      root.removeFromParent();
      clearModel();
    },
  };
}
