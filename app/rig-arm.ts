import * as T from 'three';

/** Place a two-bone arm in a stable shoulder/elbow plane, without axial twisting. */
export function poseArm(
  upper: T.Bone,
  forearm: T.Bone,
  hand: T.Bone,
  target: T.Vector3,
  pole: T.Vector3,
) {
  const a = forearm.position.clone(),
    b = hand.position.clone();
  const l1 = a.length(),
    l2 = b.length();
  const distance = T.MathUtils.clamp(
    target.length(),
    Math.abs(l1 - l2) + 0.001,
    (l1 + l2) * 0.985,
  );
  const direction = target.clone().normalize();
  const across = pole
    .clone()
    .addScaledVector(direction, -pole.dot(direction))
    .normalize();
  const along = (l1 * l1 + distance * distance - l2 * l2) / (2 * distance);
  const elbow = direction
    .clone()
    .multiplyScalar(along)
    .addScaledVector(across, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  upper.quaternion.setFromUnitVectors(a.normalize(), elbow.clone().normalize());
  const lower = direction
    .multiplyScalar(distance)
    .sub(elbow)
    .applyQuaternion(upper.quaternion.clone().invert())
    .normalize();
  forearm.quaternion.setFromUnitVectors(b.normalize(), lower);
}
