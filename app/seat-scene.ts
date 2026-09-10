import { roomAt } from './house-data';
import { sampleVisitorJourney, visitorTravelNodes } from './visitor-travel.mjs';
import { createVisitorProps, sampleSeatedActivity } from './visitor-props';
import { motionRig } from './visitor-motion';
import * as T from 'three';
import type { RoomAssets } from './asset-loading';
import type { Character } from './visitor-appearance';
import {
  acquireVisitorModel,
  partVisible,
  configureVisitorTint,
  type VisitorPart,
} from './visitor-model';
import restPoses from './visitor-rest-poses.json';
import { appearanceOptions, readAppearance } from './visitor-appearance';
import { seats, seatById, type Visitor } from './seat-data';
import {
  configureVisitorMotion,
  sampleVisitorMotion,
  visitorSeed,
  visitorShadowMaterials,
} from './visitor-motion';

// An anchor belongs to the actual furniture, so a pulled-out chair carries its visitor.
export type SeatAnchors = Map<string, T.Group>;
export function attachSeats(
  anchors: SeatAnchors,
  parent: T.Group,
  ids: string[],
) {
  parent.userData.seatIds = ids;
  for (const id of ids) {
    const seat = seatById.get(id);
    if (!seat) throw new Error(`Unknown seat: ${id}`);
    const anchor = new T.Group();
    anchor.name = `seat:${id}`;
    anchor.position.fromArray(seat.offset);
    anchor.rotation.y = seat.yaw;
    parent.add(anchor);
    anchors.set(id, anchor);
  }
}

export function createSeatScene(
  scene: T.Scene,
  anchors: SeatAnchors,
  interactables: T.Object3D[],
  invalidate: () => void,
  assets: RoomAssets,
) {
  let disposed = false,
    current: Visitor[] = [],
    me = '',
    hovered: string | null = null;
  const crowd = new T.Group();
  crowd.name = 'Seated visitors';
  scene.add(crowd);
  const meshes: {
    mesh: T.InstancedMesh;
    part: VisitorPart;
    slotIds: string[];
    motion: T.InstancedBufferAttribute;
    rest: T.InstancedBufferAttribute;
    activity: T.InstancedBufferAttribute;
  }[] = [];
  const frames = new Map<
    string,
    { root: T.Group; props: ReturnType<typeof createVisitorProps> }
  >();
  function visitorFrame(id: string) {
    let frame = frames.get(id);
    if (!frame) {
      const root = new T.Group();
      root.name = `Visitor ${id}`;
      const props = createVisitorProps();
      root.add(props.root);
      crowd.add(root);
      frame = { root, props };
      frames.set(id, frame);
    }
    return frame;
  }
  const ownedMaterials: T.Material[] = [];
  const pickingGeometries: T.BufferGeometry[] = [];
  const states = new Map<string, { seed: number; value: T.Vector4 }>();
  const releaseModels = new Map<Character, () => void>();
  const loadingModels = new Map<Character, Promise<void>>();
  const characterTasks = new Map<Character, (() => Promise<void>)[]>();
  const labels = new Map<string, { sprite: T.Sprite; signature: string }>();
  const reactions = new Map<
    string,
    { sprite: T.Sprite; event: NonNullable<Visitor['gesture']>; height: number }
  >();
  function clearReaction(id: string) {
    const entry = reactions.get(id);
    if (!entry) return;
    entry.sprite.removeFromParent();
    entry.sprite.material.map?.dispose();
    entry.sprite.material.dispose();
    reactions.delete(id);
  }
  function showReaction(
    person: Visitor,
    event: NonNullable<Visitor['gesture']>,
  ) {
    const anchor = visitorFrame(person.id).root;
    if (!anchor) return;
    const key = person.id;
    if (reactions.get(key)?.event.id === event.id) {
      anchor.add(reactions.get(key)!.sprite);
      return;
    }
    clearReaction(key);
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff9ee';
    ctx.beginPath();
    ctx.roundRect(12, 8, 168, 94, 42);
    ctx.fill();
    ctx.fillStyle = event.kind === 'heart' ? '#b66a65' : '#5c7452';
    ctx.font =
      event.kind === 'heart' ? '64px sans-serif' : '500 38px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(event.kind === 'heart' ? '♥' : '你好', 96, 59);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(
      new T.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    sprite.scale.set(0.45, 0.3, 1);
    const height =
      appearanceOptions.characters.find(
        (c) => c.id === readAppearance(person.appearance).character,
      )!.labelHeight + 0.19;
    anchor.add(sprite);
    reactions.set(key, { sprite, event, height });
  }
  const tint = new T.Color();
  const highlight = new T.Mesh(
    new T.CircleGeometry(0.26, 48),
    new T.MeshBasicMaterial({
      color: '#cfb778',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  highlight.rotation.x = -Math.PI / 2;
  highlight.position.y = 0.012;
  highlight.visible = false;
  const transform = new T.Matrix4(),
    local = new T.Matrix4(),
    position = new T.Vector3();
  function ensureCharacter(character: Character): Promise<void> {
    if (disposed || releaseModels.has(character)) return Promise.resolve();
    const pending = loadingModels.get(character);
    if (pending) return pending;
    const work = acquireVisitorModel([character])
      .then(({ parts, release }) => {
        if (disposed) {
          release();
          return;
        }
        releaseModels.set(character, release);
        for (const part of parts) {
          // The lightweight geometry shell owns instance motion; vertex buffers remain shared.
          const geometry = new T.BufferGeometry();
          geometry.index = part.geometry.index;
          for (const [name, attribute] of Object.entries(
            part.geometry.attributes,
          ))
            geometry.setAttribute(name, attribute);
          const motion = new T.InstancedBufferAttribute(
            new Float32Array(seats.length * 4),
            4,
          );
          motion.setUsage(T.DynamicDrawUsage);
          geometry.setAttribute('visitorInstanceMotion', motion);
          const rest = new T.InstancedBufferAttribute(
            new Float32Array(seats.length),
            1,
          );
          rest.setUsage(T.DynamicDrawUsage);
          geometry.setAttribute('visitorInstanceRest', rest);
          const activity = new T.InstancedBufferAttribute(
            new Float32Array(seats.length * 4),
            4,
          );
          activity.setUsage(T.DynamicDrawUsage);
          geometry.setAttribute('visitorInstanceActivity', activity);
          const material = Array.isArray(part.material)
            ? part.material.map((m) => m.clone())
            : part.material.clone();
          const state = { value: new T.Vector4() };
          for (const m of Array.isArray(material) ? material : [material]) {
            if (part.tint) configureVisitorTint(m, part.character, part.tint);
            configureVisitorMotion(m, part.character, state, true, part.eyelid);
            ownedMaterials.push(m);
          }
          const mesh = new T.InstancedMesh(geometry, material, seats.length);
          const shadow = visitorShadowMaterials(
            part.character,
            state,
            true,
            !!part.eyelid,
          );
          mesh.customDepthMaterial = shadow.depth;
          mesh.customDistanceMaterial = shadow.distance;
          ownedMaterials.push(shadow.depth, shadow.distance);
          mesh.name = `Visitors / ${part.name}`;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          mesh.boundingSphere = new T.Sphere(new T.Vector3(4, 1, 7.4), 24);
          mesh.userData.visitorMesh = true;
          // CPU hit testing must use the same resting silhouette as the GPU pose.
          // Otherwise the invisible seated body intercepts clicks above the bed.
          const restingGeometry = new T.BufferGeometry();
          restingGeometry.index = geometry.index;
          restingGeometry.setAttribute(
            'position',
            geometry.getAttribute('visitorRestPosition'),
          );
          if (geometry.hasAttribute('uv'))
            restingGeometry.setAttribute('uv', geometry.getAttribute('uv'));
          restingGeometry.computeBoundingSphere();
          pickingGeometries.push(restingGeometry);
          const pickingMesh = new T.Mesh(geometry, material);
          const instanceWorld = new T.Matrix4();
          mesh.raycast = (raycaster, hits) => {
            const intersections: T.Intersection[] = [];
            for (let i = 0; i < mesh.count; i++) {
              mesh.getMatrixAt(i, instanceWorld);
              pickingMesh.matrixWorld.multiplyMatrices(
                mesh.matrixWorld,
                instanceWorld,
              );
              pickingMesh.geometry =
                rest.getX(i) > 0.5 ? restingGeometry : geometry;
              pickingMesh.raycast(raycaster, intersections);
              for (const hit of intersections)
                hits.push({ ...hit, instanceId: i, object: mesh });
              intersections.length = 0;
            }
          };
          const slotIds: string[] = [];
          mesh.userData.seatSlots = slotIds;
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          mesh.count = 0;
          crowd.add(mesh);
          interactables.push(mesh);
          meshes.push({ mesh, part, slotIds, motion, rest, activity });
        }
        update(0, true);
        invalidate();
      })
      .finally(() => {
        loadingModels.delete(character);
      });
    loadingModels.set(character, work);
    return work;
  }
  function refreshVisible(retry = false) {
    if (disposed) return;
    const needed = new Set(
      current
        .filter((visitor) => {
          const anchor = anchors.get(visitor.seatId);
          return (
            (anchor && isVisible(anchor)) ||
            (visitor.journey &&
              !!anchors.get(visitor.journey.fromSeat) &&
              isVisible(anchors.get(visitor.journey.fromSeat)!))
          );
        })
        .map((visitor) => readAppearance(visitor.appearance).character),
    );
    for (const character of needed) {
      let starters = characterTasks.get(character);
      if (starters && !retry) continue;
      if (!starters) {
        starters = (['sit', 'rest'] as const).map((pose) =>
          assets.register('shared', `character.${character}.${pose}`, () =>
            ensureCharacter(character),
          ),
        );
        characterTasks.set(character, starters);
      }
      starters.forEach((start) => {
        void start();
      });
    }
  }
  function isVisible(o: T.Object3D) {
    for (let n: T.Object3D | null = o; n; n = n.parent)
      if (!n.visible) return false;
    return true;
  }
  function label(visitor: Visitor) {
    const anchor = visitorFrame(visitor.id).root;
    const character = readAppearance(visitor.appearance).character;
    const signature = `${visitor.name}/${visitor.id === me}/${character}/${visitor.posture}`;
    const previous = labels.get(visitor.seatId);
    if (previous?.signature === signature) return;
    if (previous) {
      previous.sprite.material.map?.dispose();
      previous.sprite.material.dispose();
      previous.sprite.removeFromParent();
    }
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.font = '500 34px system-ui, sans-serif';
    const text =
      visitor.name +
      (visitor.id === me ? ' · 我' : '') +
      (visitor.posture === 'rest' ? ' · 休息' : '');
    const width = Math.min(496, ctx.measureText(text).width + 48);
    ctx.fillStyle = visitor.id === me ? '#344b3d' : '#faf4e6';
    ctx.beginPath();
    ctx.roundRect((512 - width) / 2, 13, width, 70, 35);
    ctx.fill();
    ctx.fillStyle = visitor.id === me ? '#f9f4e9' : '#3c443c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 49, 450);
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(
      new T.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      }),
    );
    sprite.scale.set(1.05, 0.197, 1);
    sprite.position.y = appearanceOptions.characters.find(
      (option) => option.id === character,
    )!.labelHeight;
    if (visitor.posture === 'rest')
      sprite.position.set(0, restPoses[character].labelHeight, -0.59);
    sprite.userData.seatId = visitor.seatId;
    anchor.add(sprite);
    labels.set(visitor.seatId, { sprite, signature });
  }
  function update(t: number, reduced: boolean) {
    const now = Date.now();
    for (const [id, { sprite, event, height }] of reactions) {
      if (now > event.expiresAt) {
        clearReaction(id);
        continue;
      }
      sprite.position.set(
        0.15,
        height +
          (reduced ? 0 : Math.min(0.1, Math.max(0, (now - event.at) / 20000))),
        0.05,
      );
      sprite.material.opacity = Math.min(1, (event.expiresAt - now) / 1400);
    }
    const visibleVisitors = current.flatMap((visitor) => {
      const seat = seatById.get(visitor.seatId),
        anchor = anchors.get(visitor.seatId);
      if (!seat || !anchor) return [];
      const frame = visitorFrame(visitor.id),
        appearance = readAppearance(visitor.appearance);
      anchor.updateWorldMatrix(true, false);
      let stand = 0,
        rest = visitor.posture === 'rest' ? 1 : 0,
        gait = 0,
        moving = false;
      const j = visitor.journey;
      if (j && now < j.at + j.duration) {
        const sample = sampleVisitorJourney(j, now, appearance.character);
        stand = sample.stand;
        rest = sample.rest;
        gait = reduced ? 0 : sample.gait;
        moving = true;
        const p = new T.Vector3().fromArray(sample.position);
        // Chair travel and the sitting edge of the bed use the real furniture anchors.
        const actual = (id: string, posture: string) => {
          const a = anchors.get(id)!,
            spec = seatById.get(id)!;
          if (spec.kind === 'bed') {
            const local =
              posture === 'rest'
                ? new T.Vector3().fromArray(spec.offset)
                : new T.Vector3(Math.sign(spec.offset[0]) * 1.19, 0.97, 0.34);
            a.parent!.updateWorldMatrix(true, false);
            return local.applyMatrix4(a.parent!.matrixWorld);
          }
          return a.getWorldPosition(new T.Vector3());
        };
        const fromDelta = actual(j.fromSeat, j.fromPosture).sub(
          new T.Vector3().fromArray(
            visitorTravelNodes[j.fromSeat as keyof typeof visitorTravelNodes]
              .position,
          ),
        );
        const toDelta = actual(j.toSeat, j.toPosture).sub(
          new T.Vector3().fromArray(
            visitorTravelNodes[j.toSeat as keyof typeof visitorTravelNodes]
              .position,
          ),
        );
        const age = (now - j.at) / 1000;
        if (!j.path.length) {
          const f = T.MathUtils.smoothstep(age, 0, j.duration / 1000);
          p.addScaledVector(fromDelta, 1 - f).addScaledVector(toDelta, f);
          const fromYaw =
            j.fromPosture === 'rest'
              ? 0
              : (Math.sign(seat.offset[0]) * Math.PI) / 2;
          const toYaw =
            j.toPosture === 'rest'
              ? 0
              : (Math.sign(seat.offset[0]) * Math.PI) / 2;
          sample.yaw = T.MathUtils.lerp(fromYaw, toYaw, f);
        } else if (sample.phase === 'rise' || sample.phase === 'exit')
          p.addScaledVector(
            fromDelta,
            1 - T.MathUtils.smoothstep(age, j.rise, j.rise + j.exit),
          );
        else if (sample.phase === 'enter' || sample.phase === 'settle')
          p.addScaledVector(
            toDelta,
            T.MathUtils.smoothstep(
              age,
              j.rise + j.exit + j.walk,
              j.rise + j.exit + j.walk + j.enter,
            ),
          );
        frame.root.position.copy(p);
        frame.root.rotation.set(0, sample.yaw, 0);
        const room = roomAt(p.x, p.z);
        frame.root.visible =
          !!room &&
          seats.some(
            (s) =>
              s.room === room &&
              anchors.has(s.id) &&
              isVisible(anchors.get(s.id)!),
          );
      } else {
        frame.root.position.setFromMatrixPosition(anchor.matrixWorld);
        frame.root.quaternion.setFromRotationMatrix(anchor.matrixWorld);
        frame.root.visible = isVisible(anchor);
      }
      frame.root.userData.moving = moving;
      frame.root.updateMatrixWorld(true);
      let state = states.get(visitor.id);
      if (!state) {
        state = { seed: visitorSeed(visitor.id), value: new T.Vector4() };
        states.set(visitor.id, state);
      }
      sampleVisitorMotion(t, state.seed, reduced, state.value);
      const activity = moving
        ? { kind: 0, amount: 0 }
        : sampleSeatedActivity(visitor, t, reduced);
      frame.props.update(
        activity.kind,
        activity.amount,
        motionRig[appearance.character].neck,
        appearance.character,
      );
      if (rest > 0)
        state.value.set(
          rest,
          0,
          reduced ? 0 : Math.sin(t * 1.18 + (state.seed % 100)) * 0.0018,
          0,
        );
      else if (activity.kind)
        state.value.w += activity.amount * (activity.kind === 1 ? 0.12 : -0.03);
      else if (visitor.gesture && !reduced) {
        const age = (now - visitor.gesture.at) / 1000;
        if (age >= 0 && age < 5.2)
          state.value.w +=
            Math.sin(age * Math.PI * 2.2) *
            Math.sin((Math.PI * age) / 5.2) *
            0.085;
      }
      const name = labels.get(visitor.seatId)?.sprite;
      if (name) {
        name.position.set(
          0,
          T.MathUtils.lerp(
            appearanceOptions.characters.find(
              (c) => c.id === appearance.character,
            )!.labelHeight,
            restPoses[appearance.character].labelHeight,
            rest,
          ),
          -0.59 * rest,
        );
      }
      if (!frame.root.visible) return [];
      return [
        {
          seat,
          anchor: frame.root,
          visitor,
          appearance,
          stand,
          rest,
          gait,
          moving,
          activity,
        },
      ];
    });
    for (const { mesh, part, slotIds, motion, rest, activity } of meshes) {
      slotIds.length = 0;
      for (const record of visibleVisitors) {
        const { seat, anchor, appearance, visitor } = record;
        if (
          !partVisible(
            part,
            appearance,
            record.moving ? 'sit' : visitor.posture || 'sit',
          )
        )
          continue;
        const index = slotIds.length;
        slotIds.push(seat.id);
        local.copy(part.matrix);
        transform.multiplyMatrices(anchor.matrixWorld, local);
        mesh.setMatrixAt(index, transform);
        const pose = states.get(visitor.id)!.value;
        motion.setXYZW(index, pose.x, pose.y, pose.z, pose.w);
        rest.setX(index, record.rest);
        activity.setXYZW(
          index,
          record.stand,
          record.gait,
          record.activity.kind,
          record.activity.amount,
        );
        if (part.tint) mesh.setColorAt(index, tint.set(appearance[part.tint]));
      }
      mesh.count = slotIds.length;
      mesh.instanceMatrix.needsUpdate = true;
      motion.needsUpdate = rest.needsUpdate = activity.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = slotIds.length > 0;
    }
  }

  return {
    shouldFocusSeat: (id: string) =>
      !current.some((v) => v.id === me) || current.some((v) => v.seatId === id),
    snapshots: () =>
      current.map((visitor) => {
        const f = frames.get(visitor.id);
        return {
          id: visitor.id,
          seatId: visitor.seatId,
          position: f?.root.position.toArray(),
          moving:
            !!visitor.journey &&
            Date.now() < visitor.journey.at + visitor.journey.duration,
        };
      }),
    refreshVisible,
    retry: () => refreshVisible(true),
    update,
    hasVisibleVisitors: () =>
      meshes.some(({ mesh }) => mesh.visible && mesh.count > 0),
    setVisitors(visitors: Visitor[], ownId: string) {
      current = visitors;
      for (const [id, frame] of frames)
        if (!visitors.some((v) => v.id === id)) {
          frame.props.dispose();
          frame.root.removeFromParent();
          frames.delete(id);
        }
      me = ownId;
      refreshVisible();
      const identities = new Set(visitors.map((v) => v.id));
      for (const id of states.keys())
        if (!identities.has(id)) states.delete(id);
      const used = new Set(visitors.map((v) => v.seatId));
      for (const s of seats.filter((s) => s.kind === 'bed')) {
        const anchor = anchors.get(s.id);
        if (!anchor) continue;
        const person = visitors.find((v) => v.seatId === s.id);
        anchor.position.fromArray(s.offset);
        anchor.rotation.y = s.yaw;
        if (person && person.posture !== 'rest') {
          const side = Math.sign(s.offset[0]);
          anchor.position.set(side * 1.19, 0.97, 0.34);
          anchor.rotation.y = (side * Math.PI) / 2;
        }
      }
      for (const [id, entry] of labels)
        if (!used.has(id)) {
          entry.sprite.material.map?.dispose();
          entry.sprite.material.dispose();
          entry.sprite.removeFromParent();
          labels.delete(id);
        }
      visitors.forEach(label);
      for (const id of reactions.keys())
        if (!identities.has(id)) clearReaction(id);
      for (const person of visitors)
        if (
          person.gesture &&
          ['hello', 'heart'].includes(person.gesture.kind) &&
          person.gesture.expiresAt > Date.now()
        ) {
          showReaction(person, person.gesture);
          const target = visitors.find(
            (v) => v.id === person.gesture?.targetId,
          );
          if (target && target.posture !== 'rest')
            showReaction(target, person.gesture);
        }
      for (const person of visitors)
        if (person.posture === 'rest') clearReaction(person.id);
      // Place the reading book on the armrest when its cushion is in use.
      const reading = anchors.get('study-reading')?.parent;
      const book = reading?.getObjectByName('Seat reading book');
      if (book) {
        book.position.set(
          used.has('study-reading') ? 0.52 : 0.05,
          used.has('study-reading') ? 0.935 : 0.83,
          0.08,
        );
        book.rotation.z = used.has('study-reading') ? -0.04 : 0;
      }
      invalidate();
    },
    hover(id: string | null) {
      if (id === hovered) return;
      hovered = id;
      highlight.removeFromParent();
      highlight.visible = false;
      const anchor = id ? anchors.get(id) : undefined;
      if (anchor) {
        anchor.add(highlight);
        highlight.visible = true;
      }
    },
    pick(hit: T.Intersection): string | null {
      for (let o: T.Object3D | null = hit.object; o; o = o.parent) {
        if (o.userData.visitorMesh && hit.instanceId !== undefined)
          return o.userData.seatSlots[hit.instanceId] || null;
        if (o.userData.seatId) return o.userData.seatId;
        if (o.userData.seatIds)
          return (o.userData.seatIds as string[]).reduce(
            (best, id) => {
              const distance = anchors
                .get(id)!
                .getWorldPosition(position)
                .distanceToSquared(hit.point);
              return distance < best.distance ? { id, distance } : best;
            },
            { id: '', distance: Infinity },
          ).id;
      }
      return null;
    },
    dispose() {
      disposed = true;
      for (const frame of frames.values()) {
        frame.props.dispose();
        frame.root.removeFromParent();
      }
      frames.clear();
      crowd.removeFromParent();
      highlight.removeFromParent();
      highlight.geometry.dispose();
      highlight.material.dispose();
      for (const { sprite } of labels.values()) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
        sprite.removeFromParent();
      }
      for (const { mesh } of meshes) {
        const i = interactables.indexOf(mesh);
        if (i >= 0) interactables.splice(i, 1);
        mesh.dispose();
        mesh.geometry.dispose();
      }
      ownedMaterials.forEach((material) => material.dispose());
      pickingGeometries.forEach((geometry) => geometry.dispose());
      for (const id of reactions.keys()) clearReaction(id);
      releaseModels.forEach((release) => release());
      releaseModels.clear();
    },
  };
}
