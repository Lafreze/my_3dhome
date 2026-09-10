import * as T from 'three';
import { loadAssetGltf, releaseAssetTexture } from './asset-loading';
import { assetManifest } from './asset-url';
import type { ActorModel } from './life-models';
import { sampleRabbitHop } from './rabbit-motion';

export const rabbitAssetId = 'character.rabbit';

/** Render-only adapter: the existing rare visitor, navigation and collection state survive. */
export async function attachRabbit(model: ActorModel, alive: () => boolean) {
  const gltf = await loadAssetGltf(rabbitAssetId);
  gltf.scene.updateMatrixWorld(true);
  const sources: T.Mesh[] = [],
    geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) {
      sources.push(o);
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  const release = () => {
    const textures = new Set<T.Texture>();
    materials.forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v instanceof T.Texture) textures.add(v);
      });
      m.dispose();
    });
    textures.forEach(releaseAssetTexture);
    geometries.forEach((g) => g.dispose());
  };
  if (!alive()) {
    release();
    return;
  }
  if (!sources.length) {
    release();
    throw Error('Rabbit asset contains no mesh');
  }
  const avatar = new T.Group(),
    bones: T.Bone[] = [];
  avatar.name = 'rabbit/Hi3D';
  const add = (name: string, position: number[], parent?: T.Bone) => {
    const b = new T.Bone();
    b.name = `rabbit.${name}`;
    b.position.fromArray(position);
    (parent ?? avatar).add(b);
    bones.push(b);
    return b;
  };
  const body = add('body', [0, 0.28, 0]);
  const head = add('head', [0, 0.14, -0.05], body);
  const ears = [-1, 1].map((s) =>
    add(`ear.${s}`, [s * 0.19, 0.13, 0.045], head),
  );
  const arms = [-1, 1].map((s) =>
    add(`arm.${s}`, [s * 0.105, 0.025, -0.065], body),
  );
  const feet = [-1, 1].map((s) =>
    add(`foot.${s}`, [s * 0.045, -0.1, -0.015], body),
  );
  const wings = [-1, 1].map((s) =>
    add(`wing.${s}`, [s * 0.12, 0.05, 0.09], body),
  );
  const tail = add('tail', [0.08, -0.015, 0.07], body);
  const tip = add('tailTip', [0.07, -0.17, 0.01], tail);
  avatar.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  const smooth = (a: number, b: number, x: number) =>
    T.MathUtils.smoothstep(x, a, b);
  let triangles = 0;
  for (const source of sources) {
    const geo = source.geometry;
    geo.applyMatrix4(source.matrixWorld);
    const p = geo.getAttribute('position'),
      indices = new Uint16Array(p.count * 4),
      weights = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        side = x < 0 ? 0 : 1;
      const ear = smooth(0.16, 0.26, Math.abs(x)) * smooth(0.4, 0.48, y);
      const upper = smooth(0.37, 0.44, y);
      const tailW =
        (1 - smooth(0.21, 0.3, y)) *
        smooth(0.01, 0.065, z) *
        smooth(0.02, 0.1, x);
      const wing =
        (1 - upper) *
        smooth(0.05, 0.13, z) *
        smooth(0.08, 0.16, Math.abs(x)) *
        (1 - tailW);
      const arm =
        (1 - upper) *
        (1 - smooth(-0.045, 0.025, z)) *
        smooth(0.07, 0.125, Math.abs(x)) *
        (1 - smooth(0.3, 0.335, y)) *
        (1 - tailW - wing);
      const foot = (1 - smooth(0.17, 0.245, y)) * (1 - tailW - wing - arm);
      const tipW = 1 - smooth(0.1, 0.23, y);
      const influences: [T.Bone, number][] = [
        [ears[side], upper * ear],
        [head, upper * (1 - ear)],
        [tail, tailW * (1 - tipW)],
        [tip, tailW * tipW],
        [wings[side], wing],
        [arms[side], arm],
        [feet[side], foot],
        [body, Math.max(0, 1 - upper - tailW - wing - arm - foot)],
      ];
      const top = influences
        .filter(([, w]) => w > 0.00001)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      const total = top.reduce((s, [, w]) => s + w, 0);
      top.forEach(([b, w], j) => {
        indices[i * 4 + j] = bones.indexOf(b);
        weights[i * 4 + j] = w / total;
      });
    }
    geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geo.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    const mesh = new T.SkinnedMesh(geo, source.material);
    mesh.name = 'rabbit/Hi3D/skin';
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.boundingBox = new T.Box3(
      new T.Vector3(-0.5, -0.2, -0.35),
      new T.Vector3(0.5, 1.1, 0.4),
    );
    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new T.Sphere());
    avatar.add(mesh);
    mesh.bind(skeleton, new T.Matrix4());
    triangles += (geo.index?.count ?? p.count) / 3;
  }
  model.root.children.forEach((o) => {
    o.visible = o instanceof T.Mesh && o.geometry instanceof T.CircleGeometry;
  });
  model.root.add(avatar);
  model.triangles = triangles;
  Object.assign(model.root.userData, {
    assetId: rabbitAssetId,
    downloadBytes: assetManifest.assets[rabbitAssetId].size,
    bones: bones.length,
  });
  let rise = 0,
    crouch = 0,
    yaw = 0,
    pitch = 0;
  model.animate = (state, t, dt, reduced, _seated, motion) => {
    const blend = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 14);
    const hopping = state === 'hop' && !reduced && (motion?.moving ?? true);
    const hop = sampleRabbitHop(motion?.hopTime ?? t);
    const resting = ['sleep', 'hide', 'sit'].includes(state);
    const grooming = state === 'groom';
    const sniffing = state === 'sniff';
    const sway = reduced ? 0 : Math.sin(t * 1.7);
    bones.forEach((b) => b.rotation.set(0, 0, 0));
    rise +=
      ((hopping
        ? Math.min(hop.height, motion?.crouched ? 0.012 : 0.11) / 0.55
        : 0) -
        rise) *
      blend;
    crouch += ((hopping ? hop.crouch : resting ? 0.25 : 0) - crouch) * blend;
    const clearanceScale = motion?.crouched ? 0.8 : 1;
    avatar.scale.setScalar(clearanceScale);
    avatar.position.y = -0.12 * clearanceScale + rise;
    body.scale.set(1 + crouch * 0.025, 1 - crouch * 0.12, 1 + crouch * 0.03);
    body.position.y =
      0.28 - crouch * 0.01 + (reduced ? 0 : Math.sin(t * 2.1) * 0.002);
    body.rotation.x = hopping ? Math.sin(hop.flight * Math.PI * 2) * 0.075 : 0;
    // Curl the supplied hanging tail above the floor; feet establish the ground plane.
    tail.position.y = 0.01;
    tip.position.y = -0.015;
    tail.rotation.z = reduced ? 0 : Math.sin(t * 0.85) * 0.06;
    tip.rotation.y = reduced ? 0 : Math.sin(t * 1.1 + 0.8) * 0.1;
    const targetYaw = reduced
      ? 0
      : state === 'lookAround'
        ? Math.sin(t * 1.15) * 0.22
        : sniffing
          ? sway * 0.1
          : 0;
    const targetPitch = grooming
      ? -0.16
      : resting
        ? 0.09
        : sniffing && !reduced
          ? 0.06 + Math.sin(t * 6) * 0.025
          : 0;
    yaw += (targetYaw - yaw) * blend;
    pitch += (targetPitch - pitch) * blend;
    head.rotation.set(pitch, yaw, 0);
    ears.forEach((e, i) => {
      const twitch = reduced
        ? 0
        : Math.pow(Math.max(0, Math.sin(t * 0.73 + i * 2.1)), 18);
      e.rotation.z =
        (i ? -1 : 1) * (resting ? 0.13 : 0.015) + twitch * (i ? -0.12 : 0.12);
      e.rotation.x = hopping
        ? Math.sin(hop.flight * Math.PI) * 0.17
        : reduced
          ? 0
          : sway * 0.015;
    });
    arms.forEach((a, i) => {
      a.rotation.x = grooming
        ? 1.8 + (reduced ? 0 : Math.sin(t * 4.4 + i) * 0.1)
        : hopping
          ? -0.18 * Math.sin(hop.flight * Math.PI)
          : 0;
      a.rotation.z = grooming ? (i ? -0.25 : 0.25) : 0;
      a.position.y = grooming ? 0.07 : 0.025;
    });
    feet.forEach((f) => {
      f.rotation.x = hopping ? Math.sin(hop.flight * Math.PI * 2) * 0.35 : 0;
    });
    wings.forEach((w, i) => {
      w.rotation.y =
        (i ? 1 : -1) *
        (hopping
          ? Math.sin(hop.flight * Math.PI) * 0.2
          : reduced
            ? 0
            : sway * 0.025);
    });
    model.root.userData.pose = {
      state,
      height: rise * 0.55,
      headYaw: yaw,
      crouch,
    };
  };
  const oldDispose = model.dispose;
  model.dispose = () => {
    skeleton.dispose();
    release();
    avatar.removeFromParent();
    oldDispose();
  };
}
