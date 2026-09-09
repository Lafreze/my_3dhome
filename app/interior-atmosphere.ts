import * as T from 'three';
import type { Environment } from './environment-data';
import type { ObjectId } from './room-data';
import type { HouseView, RoomId } from './house-data';
import type { ActorState, Point } from './life-data';
import { catScale, sampleCatPaw } from './cat-gait';
export type CatDirective = {
  position: Point;
  rotation: number;
  room: RoomId;
  state: ActorState;
  visible: boolean;
  animationTime: number;
  travelDistance: number;
  turnDistance: number;
  navigating: boolean;
  lookAt?: Point;
};

export function createBreeze() {
  const time = { value: 0 },
    strength = { value: 0 };
  return {
    add(material: T.MeshStandardMaterial, cloth = false) {
      material.userData.live = true;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.interiorTime = time;
        shader.uniforms.interiorBreeze = strength;
        shader.vertexShader =
          `uniform float interiorTime; uniform float interiorBreeze;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
          float bend = ${cloth ? 'pow(clamp(0.5 - position.y / 2.5, 0.0, 1.0), 2.0)' : 'smoothstep(0.28, 0.95, position.y)'};
          transformed.x += sin(interiorTime * 0.47 + position.y * 2.1 + position.z) * interiorBreeze * bend * 0.012;
          transformed.z += sin(interiorTime * 0.61 + position.x * 3.0) * interiorBreeze * bend * ${cloth ? '0.045' : '0.018'};`,
          );
      };
      material.customProgramCacheKey = () => `interior-breeze-${cloth}`;
    },
    update(t: number, reduced: boolean) {
      time.value = t;
      strength.value = reduced ? 0 : 1;
    },
  };
}
export type InteriorBreeze = ReturnType<typeof createBreeze>;

/** Corrugated linen hung from a fixed rail; broad folds read at room distance. */
export function curtainGeometry(width = 0.55) {
  const geometry = new T.PlaneGeometry(width, 2.5, 32, 24);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      hem = 0.5 - y / 2.5;
    p.setXYZ(
      i,
      x * (1 + hem * 0.08),
      y + Math.sin(x * 46) * 0.008 * hem,
      Math.cos((x / width) * Math.PI * 10) * 0.038,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function interiorAtmosphere(
  roots: Record<RoomId, T.Group>,
  groups: Map<ObjectId, T.Group>,
  materials: T.Material[],
  textures: T.Texture[],
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const c = canvas.getContext('2d')!,
    gradient = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#ffffff00');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 32, 32);
  const map = new T.CanvasTexture(canvas);
  textures.push(map);
  const dustMaterial = new T.PointsMaterial({
    color: '#ffe4b6',
    map,
    size: 0.035,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  materials.push(dustMaterial);
  const dust = (Object.keys(roots) as RoomId[]).map((room, index) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.BufferAttribute(new Float32Array(18 * 3), 3),
    );
    const points = new T.Points(geometry, dustMaterial);
    points.name = 'window-dust';
    points.position.set(
      room === 'bedroom'
        ? -2.7
        : room === 'living' || room === 'gallery'
          ? 2.7
          : 0,
      1.1,
      room === 'cafe' ? 2.9 : room === 'study' ? -2.5 : 0,
    );
    points.frustumCulled = false;
    points.raycast = () => {};
    roots[room].add(points);
    return { points, index };
  });
  const fur = new T.MeshStandardMaterial({ color: '#202322', roughness: 0.93 });
  const ear = new T.MeshStandardMaterial({ color: '#524540', roughness: 0.95 });
  const eyes = new T.MeshStandardMaterial({ color: '#b9b984', roughness: 0.4 });
  materials.push(fur, ear, eyes);
  const cat = new T.Group();
  cat.name = 'kuro/the-black-cat';
  cat.userData.actorId = 'cat';
  cat.scale.setScalar(catScale);
  const ball = (
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m = fur,
  ) => {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 16), m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const body = ball(cat, 0, 0.19, 0, 0.27, 0.2, 0.39);
  const chest = ball(cat, 0, 0.29, -0.27, 0.19, 0.21, 0.18);
  const head = new T.Group();
  const ears: T.Mesh[] = [];
  head.position.set(0, 0.44, -0.3);
  cat.add(head);
  ball(head, 0, 0, 0, 0.18, 0.16, 0.15);
  for (const side of [-1, 1]) {
    const outer = new T.Mesh(new T.ConeGeometry(0.093, 0.21, 3), fur);
    outer.position.set(side * 0.125, 0.17, 0.006);
    outer.rotation.z = -side * 0.2;
    outer.castShadow = true;
    outer.raycast = () => {};
    head.add(outer);
    ears.push(outer);
    ball(head, side * 0.12, 0.135, -0.036, 0.035, 0.065, 0.013, ear);
    ball(head, side * 0.073, 0.014, -0.134, 0.036, 0.019, 0.013, eyes);
    ball(head, side * 0.073, 0.014, -0.147, 0.009, 0.017, 0.003);
  }
  // Four articulated limbs replace the two fixed resting paws on the original cat.
  // The existing body, face and fur remain; no second animal/controller is introduced.
  const limbGeometry = new T.SphereGeometry(1, 10, 8);
  const legs = [0, 1, 2, 3].map((i) => {
    const side = i % 2 ? 1 : -1,
      front = i < 2;
    const part = (name: string) => {
      const mesh = new T.Mesh(limbGeometry, fur);
      mesh.name = `cat-${front ? 'fore' : 'hind'}-${side < 0 ? 'left' : 'right'}-${name}`;
      mesh.castShadow = mesh.receiveShadow = true;
      cat.add(mesh);
      return mesh;
    };
    const upper = part('upper'),
      lower = part('lower'),
      paw = part('paw');
    paw.scale.set(0.062, 0.043, 0.087);
    return { side, front, upper, lower, paw };
  });
  ball(head, 0, -0.047, -0.157, 0.019, 0.013, 0.018, ear);
  const tail = new T.Mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3([
        new T.Vector3(0.15, 0.12, 0.26),
        new T.Vector3(0.31, 0.07, 0.34),
        new T.Vector3(0.38, 0.055, 0.05),
        new T.Vector3(0.25, 0.06, -0.18),
      ]),
      28,
      0.042,
      8,
      false,
    ),
    fur,
  );
  tail.castShadow = true;
  tail.raycast = () => {};
  const raisedTail = new T.TubeGeometry(
    new T.CatmullRomCurve3([
      new T.Vector3(0.06, 0.34, 0.32),
      new T.Vector3(0.12, 0.42, 0.52),
      new T.Vector3(0.13, 0.55, 0.68),
      new T.Vector3(0.04, 0.62, 0.7),
    ]),
    28,
    0.042,
    8,
    false,
  );
  tail.geometry.morphAttributes.position = [
    raisedTail.getAttribute('position'),
  ];
  tail.geometry.morphAttributes.normal = [raisedTail.getAttribute('normal')];
  tail.updateMorphTargets();
  raisedTail.dispose();
  cat.add(tail);
  // Resting places stay on furniture, clear of circulation and occupied seats.
  const sites: {
    room: RoomId;
    point: [number, number, number];
    yaw: number;
    seat?: string;
  }[] = [
    { room: 'study', point: [2.1, 0.86, -3.1], yaw: 0.55 },
    { room: 'living', point: [3.76, 0.85, 0.68], yaw: -1.2 },
    {
      room: 'living',
      point: [1.6, 0.79, 0.82],
      yaw: 0.15,
      seat: 'living-sofa-1',
    },
    { room: 'bedroom', point: [-3.76, 0.85, 0.68], yaw: 1.2 },
    { room: 'gallery', point: [3.76, 0.85, 0.68], yaw: -1.2 },
    {
      room: 'cafe',
      point: [7.18, 0.94, -2.15],
      yaw: -1.15,
      seat: 'cafe-banquette-1',
    },
  ];
  let view: HouseView = 'study',
    lastView: HouseView | null = null,
    nextMove = 0,
    current = -1;
  const occupied = new Set<string>();
  const tint = new T.Color('#fff1d0');
  let directive: CatDirective | null = null;
  let standing = 0,
    movement = 0,
    lastDistance = 0,
    lastAnimationTime = 0;
  const up = new T.Vector3(0, 1, 0),
    hip = new T.Vector3(),
    knee = new T.Vector3(),
    foot = new T.Vector3(),
    limb = new T.Vector3();
  function segment(
    mesh: T.Mesh,
    from: T.Vector3,
    to: T.Vector3,
    width: number,
  ) {
    limb.subVectors(to, from);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.set(width, limb.length() * 0.5 + width * 0.25, width);
    mesh.quaternion.setFromUnitVectors(up, limb.normalize());
  }
  // The original cat owns its mesh and animation; the life scheduler only supplies goals/state.
  const hit = new T.Mesh(
    new T.SphereGeometry(0.44, 8, 6),
    new T.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.22;
  cat.add(hit);
  materials.push(hit.material);
  return {
    cat,
    catPose: () => ({
      standing,
      distance: lastDistance,
      paws: legs.map((leg) => leg.paw.position.toArray()),
    }),
    setCatDirective(value: CatDirective | null) {
      directive = value;
    },
    setView(value: HouseView) {
      view = value;
    },
    setOccupied(ids: string[]) {
      occupied.clear();
      ids.forEach((id) => occupied.add(id));
    },
    update(t: number, dt: number, reduced: boolean, environment: Environment) {
      for (const { points, index } of dust) {
        points.visible =
          !reduced &&
          environment.time !== 'night' &&
          environment.weather === 'clear';
        if (!points.visible) continue;
        const p = points.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          const seed = i * 2.399 + index;
          p.setXYZ(
            i,
            Math.sin(seed) * 0.72 + Math.sin(t * 0.12 + seed) * 0.16,
            (((i / p.count) * 1.4 + t * 0.035) % 1.4) - 0.3,
            Math.cos(seed) * 0.48,
          );
        }
        p.needsUpdate = true;
      }
      const blocked =
        current >= 0 &&
        sites[current].seat &&
        occupied.has(sites[current].seat!);
      if (
        !directive &&
        (lastView !== view || blocked || (!reduced && t > nextMove))
      ) {
        const candidates = sites
          .map((site, i) => ({ site, i }))
          .filter(
            ({ site }) =>
              (view === 'overview' || view === 'plan' || site.room === view) &&
              (!site.seat || !occupied.has(site.seat)),
          );
        const choices = candidates.filter(({ i }) => i !== current);
        const chosen = (choices.length ? choices : candidates)[
          Math.floor(Math.random() * (choices.length || candidates.length))
        ];
        if (chosen) {
          current = chosen.i;
          const { site } = chosen;
          const windowId =
            site.room === 'study' ? 'window' : `${site.room}Window`;
          const parent = site.seat
            ? roots[site.room]
            : (groups.get(windowId as ObjectId) ?? roots[site.room]);
          const point = new T.Vector3(...site.point);
          roots[site.room].updateWorldMatrix(true, true);
          roots[site.room].localToWorld(point);
          parent.worldToLocal(point);
          parent.add(cat);
          cat.position.copy(point);
          cat.rotation.y = site.yaw;
          cat.visible = view !== 'plan';
        } else cat.visible = false;
        lastView = view;
        nextMove = t + 32 + Math.random() * 26;
      }
      if (directive) {
        const parent = roots[directive.room];
        if (cat.parent !== parent) parent.add(cat);
        const point = new T.Vector3(...directive.position);
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(point);
        cat.position.copy(point);
        cat.rotation.y = directive.rotation;
        cat.visible = directive.visible;
      }
      const catTime = directive?.animationTime ?? t;
      const catDt = Math.max(0, Math.min(0.1, catTime - lastAnimationTime));
      lastAnimationTime = catTime;
      const state = directive?.state ?? 'sleep';
      const upright =
        !!directive &&
        (directive.navigating ||
          ['walk', 'turn', 'rise', 'stretch'].includes(state));
      standing = T.MathUtils.damp(
        standing,
        upright ? 1 : 0,
        upright ? 7 : 5,
        catDt,
      );
      const gaitDistance =
        (directive?.travelDistance ?? 0) + (directive?.turnDistance ?? 0);
      const moved = gaitDistance > lastDistance + 0.000001;
      movement = moved ? 1 : T.MathUtils.damp(movement, 0, 16, catDt);
      lastDistance = gaitDistance;
      const bounce = reduced
        ? 0
        : Math.sin((gaitDistance / 0.3) * Math.PI * 4) *
          0.007 *
          movement *
          standing;
      body.scale.y =
        0.2 -
        standing * 0.042 +
        (reduced ? 0 : Math.sin(catTime * 1.3) * 0.003);
      body.scale.z = 0.39;
      body.position.y = 0.19 + standing * 0.19 + bounce;
      chest.position.y = 0.29 + standing * 0.15 + bounce;
      head.position.y = 0.44 + standing * 0.16 + bounce;
      tail.morphTargetInfluences![0] = standing;
      head.rotation.x = 0;
      tail.rotation.y = 0;
      head.rotation.y = reduced
        ? 0
        : Math.sin(catTime * 0.23) * 0.13 * (1 - movement);
      legs.forEach((leg, i) => {
        const step = sampleCatPaw(gaitDistance, i);
        const anchorZ = leg.front ? -0.27 : 0.25;
        const restZ = leg.front ? -0.34 : 0.29;
        foot.set(
          leg.side * 0.165,
          0.043 + step.y * standing * movement,
          T.MathUtils.lerp(restZ, anchorZ + step.z, standing),
        );
        leg.paw.position.copy(foot);
        hip.set(leg.side * 0.165, 0.14 + standing * 0.2 + bounce, anchorZ);
        // Two-link IK keeps the planted paw at floor height while the torso rises.
        const dy = foot.y - hip.y,
          dz = foot.z - hip.z;
        const reach = Math.max(0.001, Math.hypot(dy, dz));
        const bend = Math.sqrt(Math.max(0, 0.205 ** 2 - (reach * 0.5) ** 2));
        const direction = leg.front ? -1 : 1;
        knee.set(
          hip.x,
          (hip.y + foot.y) * 0.5 - ((direction * dz) / reach) * bend,
          (hip.z + foot.z) * 0.5 + ((direction * dy) / reach) * bend,
        );
        knee.y = Math.max(0.07, knee.y);
        segment(leg.upper, hip, knee, leg.front ? 0.055 : 0.074);
        segment(leg.lower, knee, foot, 0.047);
      });
      ears.forEach(
        (ear, i) =>
          (ear.rotation.z =
            (i ? 1 : -1) * -0.2 +
            (reduced
              ? 0
              : Math.sin(catTime * 0.37 + i) *
                Math.pow(Math.max(0, Math.sin(catTime * 0.19)), 12) *
                0.12)),
      );
      if (directive) {
        if (state === 'walk' && !reduced) {
          tail.rotation.y =
            Math.sin((gaitDistance / 0.3) * Math.PI * 2) * 0.09 * movement;
        }
        if (state === 'groom') {
          head.rotation.x = 0.6;
          head.rotation.y = reduced ? 0 : Math.sin(catTime * 3) * 0.18;
        }
        if (state === 'stretch' && !reduced) {
          body.scale.z = 0.39 + Math.sin(Math.min(catTime % 8, Math.PI)) * 0.05;
          body.scale.y = 0.16;
          head.rotation.x = -0.15;
        }
        if (['watchBird', 'watchRabbit', 'lookAround'].includes(state)) {
          head.rotation.x = state === 'watchBird' ? -0.38 : 0;
          head.rotation.y = reduced ? 0 : Math.sin(catTime * 0.55) * 0.2;
        }
        if (state === 'sleep') {
          head.rotation.x = 0.13;
          tail.rotation.y = reduced ? 0 : Math.sin(catTime * 0.31) * 0.018;
        }
        if (directive.lookAt) {
          const local = new T.Vector3(...directive.lookAt);
          cat.worldToLocal(local);
          head.rotation.y = T.MathUtils.clamp(
            Math.atan2(-local.x, -local.z),
            -0.75,
            0.75,
          );
        }
      }
      tint.set(environment.time === 'night' ? '#91a2b4' : '#fff1d0');
      fur.color.lerp(tint.multiplyScalar(0.016), 1 - Math.exp(-dt));
    },
  };
}
