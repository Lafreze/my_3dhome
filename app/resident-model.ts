import { assetManifest } from './asset-url';
import * as T from 'three';
import { acquireRiggedCharacter } from './rigged-character';
import type { ActorModel } from './life-models';
export const residentAssetId = 'character.rigged.resident';
export async function attachResident(model: ActorModel, alive: () => boolean) {
  const rig = await acquireRiggedCharacter('resident');
  if (!alive()) {
    rig.dispose();
    return;
  }
  model.root.children.forEach((o) => {
    o.visible = o instanceof T.Mesh && o.geometry instanceof T.CircleGeometry;
  });
  // The life engine faces -Z; visitor anchors and the new shared rig face +Z.
  rig.root.scale.setScalar(1);
  rig.root.rotation.y = Math.PI;
  model.root.scale.setScalar(1);
  model.root.add(rig.root);
  model.triangles = rig.meshes.reduce(
    (n, m) =>
      n +
      (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) /
        3,
    0,
  );
  model.root.userData.assetId = residentAssetId;
  model.root.userData.bones = rig.bones.size;
  model.root.userData.downloadBytes =
    assetManifest.assets[residentAssetId].size;
  let walk = 0,
    seatedBlend = 0,
    initialized = false,
    distance = 0;
  const previousPosition = new T.Vector3();
  const oldDispose = model.dispose;
  model.animate = (state, t, dt, reduced, seated = false, motion) => {
    const blend = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    if (!initialized) {
      seatedBlend = seated ? 1 : 0;
      previousPosition.copy(model.root.position);
      initialized = true;
    }
    seatedBlend += ((seated ? 1 : 0) - seatedBlend) * blend;
    if (motion?.seatBlend !== undefined) seatedBlend = motion.seatBlend;
    const displacement = Math.hypot(
      model.root.position.x - previousPosition.x,
      model.root.position.z - previousPosition.z,
    );
    previousPosition.copy(model.root.position);
    // Include the approach to a chair; hidden-room repositioning is not a step.
    if (displacement < 0.4) distance += displacement;
    const speed = dt > 0 && displacement < 0.4 ? displacement / dt : 0;
    const walkTarget = T.MathUtils.smoothstep(speed, 0, 0.48);
    walk += (walkTarget - walk) * blend;
    const activity = ['type', 'read', 'drinkCoffee', 'wave', 'petCat'].includes(
      state,
    )
      ? 1
      : 0;
    rig.pose({
      time: t,
      distance,
      walk,
      stand: 1 - seatedBlend,
      seatBack: model.root.userData.seatBack ?? 0,
      activity,
      amount: activity * 0.7,
      reduced,
      floorOffset: 0,
    });
  };
  model.dispose = () => {
    rig.dispose();
    oldDispose();
  };
}
