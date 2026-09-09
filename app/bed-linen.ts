import * as T from 'three';

/** Soft sewn pillow: rounded corners, a filled center and small gathered edges. */
export function pillowGeometry(width: number, height: number, depth: number) {
  const geometry = new T.SphereGeometry(1, 64, 32);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
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
    uv.setXY(i, x / width + 0.5, z / depth + 0.5);
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

/** A continuous duvet with a rounded shoulder, hanging sides and an irregular sewn hem. */
export function drapedLinen(width: number, depth: number, drop = 0.36) {
  const geometry = new T.PlaneGeometry(width + drop * 2, depth + drop, 64, 56);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i),
      v = p.getY(i) + drop / 2;
    const overX = Math.max(0, Math.abs(u) - width / 2),
      overZ = Math.max(0, v - depth / 2);
    const x =
      Math.sign(u) *
      (Math.min(Math.abs(u), width / 2) +
        Math.sin(Math.min(overX / 0.1, Math.PI / 2)) * 0.055);
    const z =
      Math.min(v, depth / 2) +
      Math.sin(Math.min(overZ / 0.1, Math.PI / 2)) * 0.055;
    const folds =
      Math.sin(u * 17 + v * 2.6) * 0.011 + Math.sin(u * 7 - v * 6) * 0.007;
    p.setXYZ(
      i,
      x + Math.sin(v * 15) * overX * 0.025,
      folds - Math.max(overX, overZ) * 0.95,
      z + Math.sin(u * 18) * overZ * 0.03,
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
