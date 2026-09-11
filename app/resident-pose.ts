import * as T from 'three';

// The source faces -Z. Bend the short trouser legs along their centreline,
// retaining each cross-section instead of blending opposing bone rotations.
const top = 0.56;
const samples = 512;
const step = 0.62 / samples;
const angles: number[] = [0],
  heights: number[] = [top],
  depths: number[] = [0.02];
for (let i = 1; i <= samples; i++) {
  const s = i * step;
  const angle =
    1.36 * T.MathUtils.smoothstep(s, 0, 0.13) -
    1.32 * T.MathUtils.smoothstep(s, 0.28, 0.39);
  angles.push(angle);
  const mid = (angle + angles[i - 1]) / 2;
  heights.push(heights[i - 1] - Math.cos(mid) * step);
  depths.push(depths[i - 1] - Math.sin(mid) * step);
}
const lookup = (values: number[], s: number) => {
  const index = T.MathUtils.clamp(s / step, 0, samples);
  const low = Math.min(samples - 1, Math.floor(index));
  return T.MathUtils.lerp(values[low], values[low + 1], index - low);
};

export function residentSeatedPoint(
  x: number,
  y: number,
  z: number,
  out = new T.Vector3(),
) {
  if (y >= top) return out.set(x, y, z);
  const s = top - y,
    angle = lookup(angles, s),
    depth = z - 0.02;
  const posedY = lookup(heights, s) - Math.sin(angle) * depth;
  const posedZ = lookup(depths, s) + Math.cos(angle) * depth;
  // Hands stay in their pockets; do not roll cuffs or jacket sleeves into the lap.
  const sleeve =
    T.MathUtils.smoothstep(Math.abs(x), 0.18, 0.25) *
    T.MathUtils.smoothstep(y, 0.32, 0.46);
  return out.set(
    x,
    T.MathUtils.lerp(posedY, y, sleeve),
    T.MathUtils.lerp(posedZ, z, sleeve),
  );
}

export function prepareResidentSeated(geometry: T.BufferGeometry) {
  const source = geometry.getAttribute('position');
  const seated = new Float32Array(source.count * 3),
    point = new T.Vector3();
  const contacts: number[] = [];
  for (let i = 0; i < source.count; i++) {
    const x = source.getX(i),
      y = source.getY(i),
      z = source.getZ(i);
    residentSeatedPoint(x, y, z, point).toArray(seated, i * 3);
    if (Math.abs(x) < 0.17 && y > 0.4 && y < 0.56 && z > 0.015)
      contacts.push(point.y);
  }
  // Recompute the target's normals once; lighting follows the tailored pose.
  const target = new T.BufferGeometry();
  target.setIndex(geometry.index);
  target.setAttribute('position', new T.BufferAttribute(seated, 3));
  target.computeVertexNormals();
  geometry.morphAttributes.position = [target.getAttribute('position')];
  geometry.morphAttributes.normal = [target.getAttribute('normal')];
  geometry.morphTargetsRelative = false;
  return contacts;
}
