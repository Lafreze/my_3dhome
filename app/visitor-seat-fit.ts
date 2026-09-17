import * as T from 'three';
import {
  visitorSeatedArmWeight,
  relaxedVisitorArm,
} from './visitor-arm-pose.ts';
import type { VisitorPart } from './visitor-model';

/** Local, static tailoring only. Standing and lying artwork retain their original shape. */
export function refineVisitorSeated(parts: VisitorPart[]) {
  const kind = parts[0]?.character;
  if (!kind) return;
  const clearance = {
    bear: 0.025,
    cat: 0.025,
    fox: 0.06,
    noir: 0.025,
    rose: 0.025,
    ivory: 0.025,
    dusk: 0.025,
    ribbon: 0.025,
  }[kind];
  const smooth = T.MathUtils.smoothstep;
  for (const part of parts.filter((p) => p.pose === 'sit')) {
    const geometry = part.geometry,
      position = geometry.getAttribute('position'),
      standing = geometry.getAttribute('visitorStandPosition');
    const relaxed = new T.Vector3();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        z = position.getZ(i);
      let nextY = y,
        nextZ = z;
      if (kind === 'bear' || kind === 'cat') {
        // Let the boots point slightly down instead of presenting both soles to the room.
        const angle =
          (kind === 'bear' ? 0.38 : 0.3) *
          smooth(z, 0.23, 0.34) *
          (1 - smooth(y, 0.015, 0.075));
        const dy = y - 0.015,
          dz = z - 0.25;
        nextY = 0.015 + Math.cos(angle) * dy - Math.sin(angle) * dz;
        nextZ = 0.25 + Math.sin(angle) * dy + Math.cos(angle) * dz;
      }
      if (kind === 'fox') {
        // Long sleeve tips drape in front of the cushion rather than through it.
        const hem =
          smooth(Math.abs(x), 0.12, 0.19) *
          (1 - smooth(y, -0.005, 0.075)) *
          smooth(z, 0.03, 0.1);
        nextZ += 0.07 * hem;
      }
      let nextX = x;
      if (standing && !part.eyelid) {
        const sx = standing.getX(i),
          sy = standing.getY(i),
          sz = standing.getZ(i);
        const weight = visitorSeatedArmWeight(kind, sx, sy, sz);
        relaxedVisitorArm(kind, sx, sy, sz, relaxed);
        nextX = T.MathUtils.lerp(x, relaxed.x, weight);
        nextY = T.MathUtils.lerp(nextY, relaxed.y, weight);
        nextZ = T.MathUtils.lerp(nextZ, relaxed.z, weight);
      }
      position.setXYZ(i, nextX, nextY, nextZ + clearance);
    }
    // Eyelid meshes are separate surfaces and must follow the same small seat offset.
    const open = geometry.getAttribute('visitorLidOpen');
    if (open)
      for (let i = 0; i < open.count; i++)
        open.setZ(i, open.getZ(i) + clearance);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}
