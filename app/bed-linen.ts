import * as T from 'three';

/** Soft sewn pillow: rounded corners, a filled center and small gathered edges. */
export function pillowGeometry(width: number, height: number, depth: number) {
  const geometry = new T.SphereGeometry(1, 64, 32);
  const positions = geometry.getAttribute('position');
  const signed = (v: number, power: number) =>
    Math.sign(v) * Math.abs(v) ** power;
  for (let i = 0; i < positions.count; i++) {
    const nx = positions.getX(i),
      ny = positions.getY(i),
      nz = positions.getZ(i);
    const x = (signed(nx, 0.5) * width) / 2;
    const z = (signed(nz, 0.5) * depth) / 2;
    const rim = Math.exp(-Math.abs(ny) * 7);
    const wrinkle = Math.sin(Math.atan2(nz, nx) * 18 + 0.4) * rim * 0.004;
    const center = Math.exp(-((x / width) ** 2 + (z / depth) ** 2) * 38);
    const y =
      (signed(ny, 0.8) * height) / 2 +
      wrinkle -
      Math.max(0, ny) * center * height * 0.09;
    positions.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
export function pillowPiping(width: number, depth: number) {
  const points = Array.from({ length: 129 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    const x = Math.cos(a),
      z = Math.sin(a);
    return new T.Vector3(
      (Math.sign(x) * Math.sqrt(Math.abs(x)) * width) / 2,
      Math.sin(a * 18 + 0.4) * 0.004,
      (Math.sign(z) * Math.sqrt(Math.abs(z)) * depth) / 2,
    );
  });
  return new T.TubeGeometry(
    new T.CatmullRomCurve3(points),
    160,
    0.0035,
    6,
    false,
  );
}
