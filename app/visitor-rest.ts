import * as T from 'three';
import poses from './visitor-rest-poses.json' with { type: 'json' };
import type { Character } from './visitor-appearance';

/** The intact standing figure is laid down with one rigid transform. */
export function visitorRestMatrix(character: Character) {
  const pose = poses[character];
  return new T.Matrix4()
    .makeRotationX(-Math.PI / 2 + pose.pitch)
    .scale(new T.Vector3(pose.scale, pose.scale, pose.scale))
    .setPosition(0, pose.lift, pose.lengthOffset);
}
export function prepareRestGeometry(
  geometry: T.BufferGeometry,
  character: Character,
) {
  const transform = visitorRestMatrix(character);
  const normal = new T.Matrix3().getNormalMatrix(transform);
  const linear = new T.Matrix3().setFromMatrix4(transform);
  const point = new T.Vector3();
  for (const [source, target] of [
    ['position', 'visitorRestPosition'],
    ['normal', 'visitorRestNormal'],
    ['visitorLidOpen', 'visitorRestLidOpen'],
    ['visitorBlinkDelta', 'visitorRestBlinkDelta'],
  ] as const) {
    if (!geometry.hasAttribute(source)) continue;
    const input = geometry.getAttribute(source);
    const output = new Float32Array(input.count * 3);
    for (let i = 0; i < input.count; i++) {
      point.fromBufferAttribute(input, i);
      if (source === 'normal') point.applyMatrix3(normal).normalize();
      else if (source === 'visitorBlinkDelta') point.applyMatrix3(linear);
      else point.applyMatrix4(transform);
      point.toArray(output, i * 3);
    }
    geometry.setAttribute(target, new T.BufferAttribute(output, 3));
  }
}
