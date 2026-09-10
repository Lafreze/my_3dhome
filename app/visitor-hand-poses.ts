import type { Character } from './visitor-appearance';
import { Matrix4, Quaternion, Vector3 } from 'three';
type Point = [number, number, number];
// Reference points on the unchanged seated meshes; no hand deformation.
export const handProfiles: Record<Character, { palm: Point; eye: Point }> = {
  bear: { palm: [-0.235, 0.105, 0.1], eye: [0, 0.51, 0.18] },
  cat: { palm: [-0.235, 0.087, 0.16], eye: [0, 0.52, 0.2] },
  fox: { palm: [-0.12, 0.18, 0.26], eye: [0, 0.45, 0.2] },
  noir: { palm: [-0.23, 0.09, 0.13], eye: [0, 0.57, 0.2] },
  rose: { palm: [-0.22, 0.1, 0.16], eye: [0, 0.48, 0.18] },
};

/** Deliberately floating props: no guessed hand or elbow deformation. */
export function floatingPhonePose(character: Character) {
  const eye = new Vector3(...handProfiles[character].eye);
  const position = new Vector3(0.06, eye.y - 0.16, eye.z + 0.29);
  const quaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(eye, position, new Vector3(0, 1, 0)),
  );
  return { position, quaternion };
}
export function floatingCupPosition(character: Character) {
  const eye = handProfiles[character].eye;
  return new Vector3(-0.18, eye[1] - 0.22, eye[2] + 0.25);
}
