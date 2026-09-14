import * as T from 'three';

/** A supported top and a single rounded edge; no side skirts or cloth inside furniture. */
export function edgeDrapeGeometry(width: number, run: number, drop: number) {
  const radius = 0.022,
    arc = (Math.PI * radius) / 2,
    length = run + arc + drop;
  const geometry = new T.PlaneGeometry(width, length, 20, 40);
  const p = geometry.getAttribute('position'),
    uv = geometry.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) * 2 - 1,
      distance = uv.getY(i) * length - run;
    let z: number, y: number;
    if (distance <= 0) {
      z = distance;
      y = 0;
    } else if (distance <= arc) {
      const angle = distance / radius;
      z = radius * Math.sin(angle);
      y = -radius * (1 - Math.cos(angle));
    } else {
      const hang = distance - arc;
      z =
        radius +
        0.004 *
          Math.sin(u * 8) *
          Math.sin((Math.min(1, hang / drop) * Math.PI) / 2);
      y = -radius - hang;
    }
    const fold = Math.pow(Math.sin(u * 9 + 0.7), 2) * 0.002;
    p.setXYZ(i, (u * width) / 2, y + 0.001 + fold, z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** Continuous inner and outer ceramic surfaces, including the basin floor. */
export function gardenBasinGeometry() {
  return new T.LatheGeometry(
    [
      [0, 0.09],
      [0.26, 0.09],
      [0.28, 0.12],
      [0.3, 0.55],
      [0.4, 0.65],
      [0.458, 0.76],
      [0.47, 0.805],
      [0.46, 0.84],
      [0.43, 0.85],
      [0.404, 0.832],
      [0.399, 0.79],
      [0.377, 0.73],
      [0.33, 0.65],
      [0.24, 0.58],
      [0.13, 0.555],
      [0, 0.555],
    ].map(([r, y]) => new T.Vector2(r, y)),
    64,
  );
}
