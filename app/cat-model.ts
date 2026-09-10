import * as T from 'three';
import { loadAssetGltf, releaseAssetTexture } from './asset-loading';
import { assetManifest } from './asset-url';
import { sampleCatPaw } from './cat-gait';
import type { ActorState } from './life-data';

export const catAssetId = 'character.cat';
export type CatRigPose = {
  standing: number;
  movement: number;
  distance: number;
  time: number;
  state: ActorState;
  headPitch: number;
  headYaw: number;
  reduced: boolean;
};
export type CatVisual = {
  root: T.Group;
  animate: (pose: CatRigPose) => void;
  snapshot: () => {
    paws: number[][];
    bones: number;
    triangles: number;
    downloadBytes: number;
  };
  dispose: () => void;
};

/** A render adapter for the existing cat controller: it owns no AI, path or clock. */
export async function loadCatVisual(
  alive: () => boolean,
): Promise<CatVisual | null> {
  const gltf = await loadAssetGltf(catAssetId);
  const source: T.Mesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) source.push(o);
  });
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  for (const mesh of source) {
    geometries.add(mesh.geometry);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
      (m) => materials.add(m),
    );
  }
  const release = () => {
    const textures = new Set<T.Texture>();
    for (const material of materials) {
      Object.values(material).forEach((v) => {
        if (v instanceof T.Texture) textures.add(v);
      });
      material.dispose();
    }
    textures.forEach(releaseAssetTexture);
    geometries.forEach((g) => g.dispose());
  };
  if (!alive()) {
    release();
    return null;
  }
  if (!source.length) {
    release();
    throw Error('Cat asset contains no mesh');
  }
  const root = new T.Group(),
    bones: T.Bone[] = [];
  root.name = 'cat/Hi3D';
  const add = (name: string, position: number[]) => {
    const bone = new T.Bone();
    bone.name = name;
    bone.position.fromArray(position);
    root.add(bone);
    bones.push(bone);
    return bone;
  };
  const body = add('cat.body', [0, 0.3, 0.04]);
  const head = add('cat.head', [0, 0.46, -0.24]);
  const tail = add('cat.tail', [0, 0.31, 0.27]);
  const tip = add('cat.tailTip', [0, 0.5, 0.43]);
  // Four measured paw anchors from this asymmetric sculpture. Keep each paw rigid.
  // The previous generic two-link IK bent the belly and used legs longer than the mesh.
  const legs = [
    [-0.145, 0.045, -0.195],
    [0.057, 0.045, -0.232],
    [-0.082, 0.045, 0.302],
    [0.136, 0.045, 0.236],
  ].map((position, i) => ({
    paw: new T.Vector3(...position),
    foot: add(`cat.paw.${i}`, position),
  }));
  root.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  let triangles = 0;
  const smooth = (a: number, b: number, x: number) =>
    T.MathUtils.smoothstep(x, a, b);
  for (const sourceMesh of source) {
    const geometry = sourceMesh.geometry;
    geometry.applyMatrix4(sourceMesh.matrixWorld);
    const positions = geometry.getAttribute('position');
    const indices = new Uint16Array(positions.count * 4),
      weights = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      const influences: [number, number][] = [];
      const weight = (bone: T.Bone, value: number) => {
        if (value > 0.00001) influences.push([bones.indexOf(bone), value]);
      };
      const tailWeight = smooth(0.23, 0.35, z) * smooth(0.29, 0.4, y);
      const headWeight =
        smooth(0.38, 0.49, y) * (1 - smooth(0.06, 0.17, z)) * (1 - tailWeight);
      const tailTip = smooth(0.43, 0.59, y);
      weight(tail, tailWeight * (1 - tailTip));
      weight(tip, tailWeight * tailTip);
      weight(head, headWeight);
      const pawWeights = legs.map((leg) => {
        const radial = Math.hypot(x - leg.paw.x, z - leg.paw.z);
        // Bind the whole paw; blend only in the furry upper leg. The central
        // underside belongs to the torso, never whichever quadrant it falls in.
        return (
          (1 - smooth(0.065, 0.255, y)) *
          (1 - smooth(0.072, 0.21, radial)) *
          (1 - tailWeight) *
          (1 - headWeight)
        );
      });
      const totalPaws = pawWeights.reduce((sum, w) => sum + w, 0);
      const available = Math.max(0, 1 - tailWeight - headWeight);
      const factor = totalPaws > available ? available / totalPaws : 1;
      legs.forEach((leg, k) => weight(leg.foot, pawWeights[k] * factor));
      weight(body, Math.max(0, available - totalPaws * factor));
      influences.sort((a, b) => b[1] - a[1]);
      const top = influences.slice(0, 4),
        sum = top.reduce((s, v) => s + v[1], 0);
      top.forEach(([id, w], j) => {
        indices[i * 4 + j] = id;
        weights[i * 4 + j] = w / sum;
      });
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute(
      'skinWeight',
      new T.Float32BufferAttribute(weights, 4),
    );
    const mesh = new T.SkinnedMesh(geometry, sourceMesh.material);
    mesh.name = 'cat/Hi3D/skin';
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.boundingBox = new T.Box3(
      new T.Vector3(-0.5, -0.15, -0.65),
      new T.Vector3(0.5, 1, 0.7),
    );
    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new T.Sphere());
    root.add(mesh);
    mesh.bind(skeleton, new T.Matrix4());
    triangles += (geometry.index?.count ?? positions.count) / 3;
  }
  const animate = (pose: CatRigPose) => {
    // A sculpture's resting posture needs a small crouch, not a flattened torso.
    const drop = -0.024 * (1 - pose.standing),
      breath = pose.reduced ? 0 : Math.sin(pose.time * 1.3) * 0.0015;
    body.position.y = 0.3 + drop + breath;
    head.position.y = 0.46 + drop + breath;
    head.rotation.set(-pose.headPitch * 0.32, pose.headYaw * 0.4, 0);
    tail.position.y = 0.31 + drop;
    tip.position.y = 0.5 + drop;
    const sway = pose.reduced ? 0 : Math.sin(pose.time * 0.8) * 0.018;
    tail.rotation.z = sway;
    tip.rotation.z = sway * 1.5;
    legs.forEach((leg, i) => {
      const step = sampleCatPaw(pose.distance, i);
      leg.foot.position.copy(leg.paw);
      leg.foot.position.z += step.z * pose.standing;
      leg.foot.position.y += step.y * pose.standing * pose.movement;
    });
    root.updateMatrixWorld(true);
    skeleton.update();
  };
  return {
    root,
    animate,
    snapshot: () => ({
      paws: legs.map((l) => l.foot.position.toArray()),
      bones: bones.length,
      triangles,
      downloadBytes: assetManifest.assets[catAssetId].size,
    }),
    dispose() {
      skeleton.dispose();
      release();
      root.removeFromParent();
    },
  };
}
