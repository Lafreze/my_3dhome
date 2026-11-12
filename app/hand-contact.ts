import * as T from 'three';

/** A contact point inside the palm, measured from the model rather than its wrist joint. */
export function palmAnchor(meshes: T.SkinnedMesh[], bone: T.Bone) {
  const center = new T.Vector3(),
    p = new T.Vector3();
  let total = 0;
  for (const mesh of meshes) {
    const index = mesh.skeleton.bones.indexOf(bone);
    if (index < 0) continue;
    const positions = mesh.geometry.getAttribute('position');
    const joints = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < positions.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++)
        if (joints.getComponent(i, j) === index)
          weight += weights.getComponent(i, j);
      if (weight < 0.8) continue;
      p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      center.addScaledVector(p, weight);
      total += weight;
    }
  }
  if (total) center.multiplyScalar(1 / total);
  else bone.getWorldPosition(center);
  return bone.worldToLocal(center);
}

/** Book undersides touch both palms; its page normal points up and toward the reader. */
export function bookContact(
  left: T.Vector3,
  right: T.Vector3,
  up: T.Vector3,
  forward: T.Vector3,
) {
  const x = right.clone().sub(left).normalize();
  const y = up.clone().multiplyScalar(0.86).addScaledVector(forward, -0.51);
  y.addScaledVector(x, -y.dot(x)).normalize();
  const z = new T.Vector3().crossVectors(x, y).normalize();
  return {
    position: left
      .clone()
      .add(right)
      .multiplyScalar(0.5)
      .addScaledVector(y, 0.025),
    quaternion: new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().makeBasis(x, y, z),
    ),
    width: left.distanceTo(right) + 0.035,
  };
}
