import * as T from 'three';
import { loadAssetGltf, releaseAssetTexture } from './asset-loading';
import { assetManifest } from './asset-url';
import type { ActorModel } from './life-models';

export const residentAssetId = 'character.resident';
const smooth = (a: number, b: number, x: number) =>
  T.MathUtils.smoothstep(x, a, b);

/** The supplied sculpture has no rig. A small, continuous skin keeps its original
 * hands-in-pockets silhouette while providing sitting, walking and head gestures. */
export async function attachResident(model: ActorModel, alive: () => boolean) {
  const gltf = await loadAssetGltf(residentAssetId);
  const source: T.Mesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) source.push(o);
  });
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  source.forEach((m) => {
    geometries.add(m.geometry);
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((v) =>
      materials.add(v),
    );
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
  if (!source.length) {
    release();
    throw new Error('Resident asset contains no mesh');
  }
  const avatar = new T.Group(),
    bones: T.Bone[] = [];
  const add = (name: string, position: number[], parent?: T.Bone) => {
    const b = new T.Bone();
    b.name = name;
    b.position.fromArray(position);
    (parent ?? avatar).add(b);
    bones.push(b);
    return b;
  };
  const pelvis = add('resident.pelvis', [0, 0.62, 0]);
  const spine = add('resident.spine', [0, 0.21, 0], pelvis);
  const head = add('resident.head', [0, 0.2, 0], spine);
  const legs = [-1, 1].map((side) => {
    const thigh = add(`resident.thigh.${side}`, [side * 0.13, 0, 0], pelvis);
    const shin = add(`resident.shin.${side}`, [0, -0.3, 0], thigh);
    const foot = add(`resident.foot.${side}`, [0, -0.23, -0.025], shin);
    return { thigh, shin, foot };
  });
  const shoulders = [-1, 1].map((side) =>
    add(`resident.shoulder.${side}`, [side * 0.18, 0.035, 0], spine),
  );
  avatar.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  let triangles = 0;
  for (const m of source) {
    const geo = m.geometry;
    geo.applyMatrix4(m.matrixWorld);
    const position = geo.getAttribute('position'),
      indices = new Uint16Array(position.count * 4),
      weights = new Float32Array(position.count * 4);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        influences: [number, number][] = [];
      const lower = 1 - smooth(0.54, 0.65, y);
      const headWeight = smooth(0.96, 1.04, y);
      const torso = smooth(0.63, 0.87, y) * (1 - headWeight);
      const addWeight = (b: T.Bone, w: number) => {
        if (w > 0.00001) influences.push([bones.indexOf(b), w]);
      };
      addWeight(head, headWeight);
      const shoulder =
        torso * smooth(0.15, 0.24, Math.abs(x)) * smooth(0.65, 0.76, y) * 0.65;
      addWeight(shoulders[x < 0 ? 0 : 1], shoulder);
      addWeight(spine, (torso - shoulder) * (1 - lower));
      addWeight(pelvis, (1 - headWeight - torso) * (1 - lower));
      const side = x < 0 ? 0 : 1;
      const knee = 1 - smooth(0.28, 0.36, y),
        ankle = 1 - smooth(0.08, 0.14, y);
      addWeight(legs[side].thigh, lower * (1 - knee));
      addWeight(legs[side].shin, lower * knee * (1 - ankle));
      addWeight(legs[side].foot, lower * knee * ankle);
      influences.sort((a, b) => b[1] - a[1]);
      const top = influences.slice(0, 4),
        total = top.reduce((s, v) => s + v[1], 0);
      top.forEach(([index, w], j) => {
        indices[i * 4 + j] = index;
        weights[i * 4 + j] = w / total;
      });
    }
    geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geo.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    const mesh = new T.SkinnedMesh(geo, m.material);
    mesh.name = 'resident/Hi3D';
    mesh.frustumCulled = false;
    mesh.receiveShadow = false;
    // Cover all procedural poses without scanning 50k triangles on every pick.
    mesh.boundingBox = new T.Box3(
      new T.Vector3(-0.55, -0.15, -0.75),
      new T.Vector3(0.55, 1.8, 0.55),
    );
    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new T.Sphere());
    avatar.add(mesh);
    mesh.bind(skeleton, new T.Matrix4());
    triangles += (geo.index?.count ?? position.count) / 3;
  }
  // Retain the existing contact shadow and fallback allocation for clean disposal.
  model.root.children.forEach((o) => {
    o.visible = o instanceof T.Mesh && o.geometry instanceof T.CircleGeometry;
  });
  model.root.scale.setScalar(1.05);
  model.root.add(avatar);
  model.triangles = triangles;
  model.root.userData.assetId = residentAssetId;
  model.root.userData.downloadBytes =
    assetManifest.assets[residentAssetId].size;
  model.root.userData.bones = bones.length;
  let sitBlend = 0,
    crouchBlend = 0,
    headPitch = 0,
    headYaw = 0,
    gestureTime = 0,
    previousState = '';
  const oldDispose = model.dispose;
  model.animate = (state, t, dt, reduced, seated = false, motion) => {
    if (previousState !== state) {
      previousState = state;
      gestureTime = 0;
    }
    gestureTime += Math.min(dt, 0.1);
    const blend = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 7);
    sitBlend += ((seated ? 1 : 0) - sitBlend) * blend;
    crouchBlend +=
      ((state === 'petCat' && !seated ? 1 : 0) - crouchBlend) * blend;
    bones.forEach((b) => b.rotation.set(0, 0, 0));
    avatar.position.y = -0.55 * sitBlend - 0.25 * crouchBlend;
    const walk =
      state === 'walk' && !reduced
        ? Math.sin(
            ((motion?.travelDistance ?? t * 0.62) / 0.68) * Math.PI * 2,
          ) *
          (1 - sitBlend) *
          0.22
        : 0;
    legs.forEach((leg, i) => {
      const stride = walk * (i ? 1 : -1);
      leg.thigh.rotation.x = 1.38 * sitBlend + 0.6 * crouchBlend + stride;
      leg.shin.rotation.x =
        -1.38 * sitBlend - 1.05 * crouchBlend - Math.max(0, -stride) * 0.7;
      leg.foot.rotation.x = 0.08 * sitBlend + 0.35 * crouchBlend;
    });
    spine.rotation.x = 0.2 * crouchBlend;
    // This supplied model has a neutral neck: never apply the old model's roll correction.
    const nod =
      !reduced &&
      ['wave', 'lookAround', 'drinkCoffee'].includes(state) &&
      gestureTime < 1.2
        ? -Math.sin((gestureTime / 1.2) * Math.PI) * 0.06
        : 0;
    const gaze =
      !reduced && ['inspectArtwork', 'lookOutside', 'think'].includes(state)
        ? Math.sin(Math.min(1, gestureTime / 8) * Math.PI) *
          (state === 'lookOutside' ? 0.2 : 0.1)
        : 0;
    const listening =
      state === 'listenMusic' && !reduced ? Math.sin(t * 1.7) * 0.025 : 0;
    headPitch += (nod + listening - headPitch) * blend;
    headYaw += (gaze - headYaw) * blend;
    head.rotation.set(headPitch, headYaw, 0);
    shoulders.forEach((shoulder, i) => {
      shoulder.rotation.z =
        !reduced && state === 'stretch'
          ? Math.sin(Math.min(1, gestureTime / 8) * Math.PI) * (i ? -0.1 : 0.1)
          : 0;
      shoulder.rotation.x =
        !reduced && state === 'type' ? Math.sin(t * 2 + i) * 0.02 : 0;
    });
    if (state === 'think')
      spine.rotation.x =
        Math.sin(Math.min(1, gestureTime / 8) * Math.PI) * 0.035;
    avatar.updateMatrixWorld(true);
    skeleton.update();
  };
  model.dispose = () => {
    skeleton.dispose();
    release();
    avatar.removeFromParent();
    oldDispose();
  };
}
