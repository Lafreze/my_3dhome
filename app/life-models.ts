import * as T from 'three';
import { appearanceOptions } from './visitor-appearance';
import type { ActorId, ActorState } from './life-data';
import { loadAssetGltf, releaseAssetTexture } from './asset-loading';

export type ActorModel = {
  root: T.Group;
  animate: (
    state: ActorState,
    t: number,
    dt: number,
    reduced: boolean,
    seated?: boolean,
  ) => void;
  dispose: () => void;
  triangles: number;
};
/** Replacement GLBs use the same state names; loading errors leave the procedural model intact. */
export async function attachActorAsset(
  model: ActorModel,
  assetId: string,
  alive: () => boolean,
) {
  const gltf = await loadAssetGltf(assetId);
  const dispose = () => {
    gltf.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          Object.values(m).forEach((v) => {
            if (v instanceof T.Texture) releaseAssetTexture(v);
          });
          m.dispose();
        }
      }
    });
  };
  if (!alive()) {
    dispose();
    return null;
  }
  const mixer = new T.AnimationMixer(gltf.scene),
    actions = new Map(
      gltf.animations.map((c) => [c.name, mixer.clipAction(c)]),
    );
  const once = new Set([
    'wave',
    'petCat',
    'hop',
    'hide',
    'land',
    'hopShort',
    'takeOff',
  ]);
  for (const [name, action] of actions)
    if (once.has(name)) {
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
  const idle = () => {
    const next = actions.get('idle');
    if (current && next && current !== next) {
      current.fadeOut(0.2);
      next.reset().fadeIn(0.2).play();
      current = next;
    }
  };
  mixer.addEventListener('finished', idle);
  const placeholder = model.root.children.slice();
  placeholder.forEach((o) => (o.visible = false));
  model.root.add(gltf.scene);
  let current: T.AnimationAction | undefined;
  let lastState: ActorState | null = null;
  return {
    animate(state: ActorState, dt: number, reduced: boolean) {
      const next = actions.get(state) ?? actions.get('idle');
      if (lastState !== state) {
        current?.fadeOut(0.2);
        next?.reset().fadeIn(0.2).play();
        current = next;
        lastState = state;
        if (reduced) mixer.update(0);
      }
      if (!reduced) mixer.update(dt);
    },
    dispose() {
      mixer.removeEventListener('finished', idle);
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
      gltf.scene.removeFromParent();
      dispose();
    },
  };
}
export function createActorModel(id: Exclude<ActorId, 'cat'>): ActorModel {
  const root = new T.Group();
  root.name = `life/${id}`;
  if (id === 'resident') root.scale.set(0.78, 1.16, 0.78);
  root.userData.actorId = id;
  const geos = new Set<T.BufferGeometry>(),
    mats = new Set<T.Material>();
  const mat = (color: string, metalness = 0) => {
    const m = new T.MeshStandardMaterial({
      color,
      roughness: metalness ? 0.45 : 0.9,
      metalness,
    });
    mats.add(m);
    return m;
  };
  const white = mat('#e9e4d7'),
    dark = mat('#282d2a'),
    pink = mat('#c89185'),
    gold = mat('#b4935c', 0.5);
  const ball = (
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: T.Material,
  ) => {
    const g = new T.SphereGeometry(1, 12, 8);
    geos.add(g);
    const o = new T.Mesh(g, m);
    o.scale.set(sx, sy, sz);
    o.position.set(x, y, z);
    p.add(o);
    return o;
  };
  const joint = (p: T.Object3D, x: number, y: number, z: number) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };
  const cylinder = (
    p: T.Object3D,
    r: number,
    h: number,
    y: number,
    m: T.Material,
  ) => {
    const g = new T.CylinderGeometry(r, r, h, 24);
    geos.add(g);
    const o = new T.Mesh(g, m);
    o.position.y = y;
    p.add(o);
    return o;
  };
  const body = joint(root, 0, 0, 0),
    head = joint(
      body,
      0,
      id === 'resident' ? 1.3 : id === 'rabbit' ? 0.24 : 0.15,
      0,
    );
  const arms: T.Group[] = [],
    legs: T.Group[] = [],
    ears: T.Mesh[] = [],
    wings: T.Mesh[] = [];
  const cup = joint(body, 0.17, 0.76, -0.26),
    book = joint(body, 0, 0.7, -0.32);
  cup.visible = book.visible = false;
  if (id === 'resident') {
    // Match the visitors' warm skin, dark hair and editable outfit palette; NPC never enters presence data.
    const clothes = mat(appearanceOptions.characterColors.bear.topColor),
      pants = mat('#4d5655'),
      skin = mat('#e8c9ad'),
      hair = mat('#37322d'),
      apron = mat('#7c8c73');
    ball(body, 0, 0.76, 0, 0.27, 0.36, 0.2, clothes);
    ball(body, 0, 0.68, -0.17, 0.23, 0.26, 0.035, apron);
    ball(head, 0, 0, 0, 0.3, 0.3, 0.27, skin);
    ball(head, 0, 0.105, 0.048, 0.307, 0.22, 0.254, hair);
    for (const side of [-1, 1]) {
      ball(head, side * 0.105, -0.02, -0.245, 0.018, 0.027, 0.01, dark);
      ball(head, side * 0.16, -0.09, -0.23, 0.041, 0.018, 0.013, pink);
      const arm = joint(body, side * 0.29, 0.93, 0);
      ball(arm, 0, -0.17, 0, 0.075, 0.21, 0.08, clothes);
      ball(arm, 0, -0.36, 0, 0.066, 0.08, 0.062, skin);
      arms.push(arm);
      const leg = joint(body, side * 0.13, 0.48, 0);
      ball(leg, 0, -0.17, 0, 0.09, 0.22, 0.1, pants);
      ball(leg, 0, -0.39, -0.035, 0.1, 0.065, 0.14, dark);
      legs.push(leg);
    }
    cylinder(cup, 0.06, 0.095, 0, white);
    const ring = new T.TorusGeometry(0.06, 0.011, 6, 16);
    geos.add(ring);
    const lip = new T.Mesh(ring, white);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.05;
    cup.add(lip);
    ball(cup, 0, 0.049, 0, 0.046, 0.003, 0.046, mat('#4d3020'));
    ball(cup, 0.069, 0, 0, 0.025, 0.035, 0.01, white);
    const bookGeo = new T.BoxGeometry(0.3, 0.025, 0.21);
    geos.add(bookGeo);
    book.add(new T.Mesh(bookGeo, white));
    book.rotation.x = -0.25;
  } else if (id === 'rabbit') {
    ball(body, 0, 0.16, 0.09, 0.18, 0.16, 0.23, white);
    head.position.z = -0.12;
    ball(head, 0, 0, 0, 0.14, 0.14, 0.125, white);
    for (const side of [-1, 1]) {
      const ear = ball(
        head,
        side * 0.07,
        0.21,
        0.015,
        0.048,
        0.17,
        0.035,
        white,
      );
      ears.push(ear);
      ball(head, side * 0.07, 0.21, -0.018, 0.021, 0.12, 0.008, pink);
      ball(head, side * 0.075, 0.02, -0.105, 0.012, 0.016, 0.006, dark);
      ball(body, side * 0.1, 0.035, -0.05, 0.056, 0.035, 0.1, white);
    }
    ball(head, 0, -0.025, -0.129, 0.018, 0.012, 0.012, pink);
    ball(body, 0, 0.18, 0.3, 0.07, 0.07, 0.07, white);
  } else if (id === 'bird') {
    const feather = mat('#778980'),
      breast = mat('#d8bea0');
    ball(body, 0, 0.1, 0.03, 0.085, 0.11, 0.14, feather);
    head.position.set(0, 0.2, -0.085);
    ball(head, 0, 0, 0, 0.073, 0.071, 0.07, feather);
    ball(body, 0, 0.105, -0.045, 0.065, 0.075, 0.05, breast);
    for (const side of [-1, 1]) {
      ball(head, side * 0.043, 0.018, -0.052, 0.009, 0.01, 0.008, dark);
      wings.push(
        ball(body, side * 0.08, 0.13, 0.04, 0.027, 0.07, 0.14, feather),
      );
      ball(body, side * 0.036, 0.012, 0, 0.025, 0.011, 0.044, gold);
    }
    ball(head, 0, -0.02, -0.079, 0.018, 0.012, 0.034, gold);
    ball(body, 0, 0.07, 0.2, 0.04, 0.018, 0.1, feather);
  } else {
    cylinder(body, 0.25, 0.12, 0.075, dark);
    cylinder(body, 0.235, 0.055, 0.145, white);
    cylinder(body, 0.065, 0.05, 0.198, dark);
    ball(body, 0, 0.179, -0.12, 0.036, 0.006, 0.011, mat('#839f86'));
    head.visible = false;
  }
  // Secondary actors use one inexpensive contact disc, not moving shadow-map casters.
  const shadowGeo = new T.CircleGeometry(
    id === 'resident' ? 0.28 : id === 'robot' ? 0.26 : 0.18,
    24,
  );
  geos.add(shadowGeo);
  const shadowMat = new T.MeshBasicMaterial({
    color: '#2e2b23',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  mats.add(shadowMat);
  const shadow = new T.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  shadow.raycast = () => {};
  root.add(shadow);
  let triangles = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh)
      triangles +=
        (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) /
        3;
  });
  return {
    root,
    triangles,
    animate(state, t, dt, reduced, seated = false) {
      const wave = reduced ? 0 : Math.sin(t * 3),
        walking = ['walk', 'hop', 'cleaning', 'returnToDock'].includes(state);
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      cup.visible = false;
      book.visible = false;
      arms.forEach((a) => a.rotation.set(0, 0, 0));
      legs.forEach((a) => a.rotation.set(0, 0, 0));
      if (id === 'resident') {
        if (seated) {
          legs.forEach((a) => (a.rotation.x = -1.35));
          body.position.y = -0.46;
        }
        if (walking && !reduced) {
          legs.forEach(
            (a, i) => (a.rotation.x = Math.sin(t * 4 + i * Math.PI) * 0.35),
          );
          arms.forEach(
            (a, i) => (a.rotation.x = -Math.sin(t * 4 + i * Math.PI) * 0.2),
          );
        }
        if (state === 'type') {
          arms.forEach(
            (a, i) =>
              (a.rotation.x =
                -0.95 + (reduced ? 0 : Math.sin(t * 5 + i * 2) * 0.06)),
          );
          head.rotation.x = 0.12;
        }
        if (state === 'read') {
          book.visible = true;
          arms.forEach((a) => (a.rotation.x = -0.8));
          head.rotation.x = 0.23;
          book.rotation.z = reduced ? 0 : Math.sin(t * 0.6) * 0.04;
        }
        if (['drinkCoffee', 'cleanCup', 'brewCoffee', 'wave'].includes(state)) {
          cup.visible = state !== 'wave' || Math.floor(t / 3) % 3 === 2;
          arms[1].rotation.x =
            state === 'wave'
              ? -2.35
              : state === 'drinkCoffee'
                ? -1.6
                : state === 'brewCoffee'
                  ? -2.65
                  : -1.3;
          arms[0].rotation.x = state === 'cleanCup' ? -0.95 : -0.3;
          arms[1].rotation.z = state === 'wave' ? wave * 0.15 : wave * 0.03;
          cup.position.set(0.17, state === 'drinkCoffee' ? 1.05 : 0.76, -0.29);
          if (state === 'brewCoffee') cup.position.set(0.17, 1.26, -0.49);
          if (state === 'cleanCup') arms[0].rotation.z = wave * 0.08;
        }
        if (state === 'inspectArtwork') {
          head.rotation.y = reduced ? 0 : Math.sin(t * 0.4) * 0.2;
          head.rotation.x = 0.08;
        }
        if (state === 'lookAround')
          head.rotation.x = reduced ? 0.1 : Math.sin(t * 3) * 0.14;
        if (state === 'petCat') {
          body.position.y = -0.35;
          body.rotation.x = 0.35;
          legs.forEach((a) => (a.rotation.x = -0.8));
          arms[1].rotation.x = -0.55;
          arms[1].rotation.z = wave * 0.08;
        }
        if (state === 'idle' && !reduced)
          head.rotation.x = Math.sin(t * 0.7) * 0.02;
      } else if (id === 'rabbit') {
        if (state === 'hop' && !reduced) {
          body.position.y = Math.max(0, Math.sin(t * 5)) * 0.11;
          body.rotation.x = Math.sin(t * 5) * 0.08;
        }
        if (['sleep', 'sit', 'hide'].includes(state))
          body.scale.y = state === 'sit' ? 0.92 : 0.74;
        if (state === 'lookAround' || state === 'sniff')
          head.rotation.y = reduced ? 0 : Math.sin(t * 1.4) * 0.33;
        if (state === 'groom') {
          head.rotation.x = 0.5;
          head.rotation.z = reduced ? 0 : Math.sin(t * 4) * 0.1;
        }
        ears.forEach(
          (e, i) =>
            (e.rotation.z = reduced ? 0 : Math.sin(t * 0.5 + i) * 0.045),
        );
      } else if (id === 'bird') {
        wings.forEach(
          (w, i) =>
            (w.rotation.z =
              (state === 'land' || state === 'takeOff') && !reduced
                ? Math.sin(t * 18) * (i ? 1 : -1) * 1.1
                : 0),
        );
        head.rotation.y = reduced ? 0 : Math.sin(t * 1.3) * 0.35;
        if (state === 'peck')
          body.rotation.x = reduced ? 0 : Math.max(0, Math.sin(t * 3)) * 0.48;
        if (state === 'preen') head.rotation.y = 1.3;
        if (state === 'hopShort' && !reduced)
          body.position.y = Math.max(0, Math.sin(t * 3)) * 0.025;
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      root.removeFromParent();
    },
  };
}
