import { createHeldAction } from './held-action';
import { createVisitorProps } from './visitor-props';
import { assetManifest } from './asset-url';
import * as T from 'three';
import { acquireRiggedCharacter } from './rigged-character';
import type { ActorModel } from './life-models';
import { residentScale } from './resident-motion';
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
  rig.root.scale.setScalar(residentScale);
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
    distance = 0,
    actionAge = 0,
    previousKind = 0,
    previousYaw = 0;
  const action = createHeldAction();
  const props = createVisitorProps();
  props.root.scale.setScalar(residentScale);
  model.root.add(props.root);
  const previousPosition = new T.Vector3();
  const oldDispose = model.dispose;
  model.animate = (state, t, dt, reduced, seated = false, motion) => {
    const blend = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    if (!initialized) {
      seatedBlend = seated ? 1 : 0;
      previousPosition.copy(model.root.position);
      previousYaw = model.root.rotation.y;
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
    const turn = Math.abs(
      Math.atan2(
        Math.sin(model.root.rotation.y - previousYaw),
        Math.cos(model.root.rotation.y - previousYaw),
      ),
    );
    previousYaw = model.root.rotation.y;
    const turning = state === 'turn' && !seated ? turn * 0.12 : 0;
    distance += turning;
    const speed =
      dt > 0 && displacement < 0.4 ? (displacement + turning) / dt : 0;
    const walkTarget = T.MathUtils.smoothstep(speed, 0, 0.42);
    walk += (walkTarget - walk) * blend;
    const kind =
      (
        {
          type: 11,
          read: 3,
          drinkCoffee: 2,
          brewCoffee: 12,
          cleanCup: 13,
          wave: 6,
          stretch: 10,
          inspectArtwork: 9,
          think: 8,
        } as Record<string, number>
      )[state] ?? 0;
    const held = action.sample(
      motion?.moving || walk > 0.15 || state === 'rise' || state === 'settle'
        ? 0
        : kind,
      1,
      dt,
      reduced,
    );
    if (held.kind !== previousKind) actionAge = 0;
    else if (!reduced) actionAge += Math.min(dt, 0.1);
    previousKind = held.kind;
    rig.pose({
      time: t,
      distance,
      walk,
      stand: 1 - seatedBlend,
      seatBack: (model.root.userData.seatBack ?? 0) / residentScale,
      activity: held.kind,
      actionAge,
      amount: held.amount,
      reduced,
      floorOffset: 0,
    });
    props.update(
      held.kind === 13 ? 2 : held.kind,
      held.amount,
      'resident',
      actionAge,
    );
    props.follow(rig);
  };
  model.dispose = () => {
    props.dispose();
    rig.dispose();
    oldDispose();
  };
}
