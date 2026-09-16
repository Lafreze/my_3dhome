import * as T from 'three';
import type { Character } from './visitor-appearance';

const smooth = (a: number, b: number, value: number) =>
  T.MathUtils.smoothstep(value, a, b);
/** Weights are authored on the intact standing surface, before any seated leg bend. */
export function visitorArmWeight(
  character: Character,
  x: number,
  y: number,
  z: number,
) {
  if (character === 'bear' || character === 'cat') {
    const scale = character === 'bear' ? 1.27 : 1.46;
    const height = y / scale + (character === 'bear' ? -0.137 : -0.173);
    const side = Math.abs(x / scale);
    if (character === 'bear')
      return Math.max(
        smooth(0.115, 0.147, side) * (1 - smooth(0.035, 0.095, height)),
        smooth(0.115, 0.135, x / scale) * (1 - smooth(-0.185, -0.17, height)),
      );
    return (
      smooth(0.123, 0.148, side) *
      (1 - smooth(0.005, 0.09, height)) *
      smooth(-0.265, -0.24, height)
    );
  }
  if (character === 'fox') {
    const height = y / 1.15 - 0.236,
      depth = -z / 1.15,
      side = Math.abs(x / 1.15);
    const tail = Math.max(
      smooth(0.075, 0.135, depth),
      smooth(0.16, 0.235, side) * smooth(-0.035, 0.025, depth),
      smooth(-0.05, -0.015, depth) * (1 - smooth(-0.2, -0.13, height)),
    );
    return (
      Math.max(smooth(0.07, 0.115, side), smooth(0.14, 0.2, -depth)) *
      (1 - smooth(-0.065, -0.025, height)) *
      (1 - smooth(0.295, 0.325, -height)) *
      (1 - tail)
    );
  }
  const fit =
    character === 'rose'
      ? 0.8731751925014212
      : character === 'ivory'
        ? 0.9591046608232041
        : 1;
  const contact =
    character === 'noir'
      ? 0.40210498347
      : character === 'rose'
        ? 0.44112171454206484
        : 0.462231048;
  const height = y / fit + contact;
  return (
    smooth(0.14, 0.21, Math.abs(x / fit)) *
    (1 - smooth(0.78, 0.84, height)) *
    smooth(0.3, 0.4, height)
  );
}

/** The kimono hem keeps its authored seated fold; only the raised forearms settle. */
export function visitorSeatedArmWeight(
  character: Character,
  x: number,
  y: number,
  z: number,
) {
  return (
    visitorArmWeight(character, x, y, z) *
    (character === 'fox' ? smooth(0.02, 0.11, y) : 1)
  );
}

/** Restore shoulders, cuffs, fingers and the bear's bag together; never pull hands into the lap. */
export function relaxedVisitorArm(
  character: Character,
  x: number,
  y: number,
  z: number,
  out = new T.Vector3(),
) {
  out.set(x, y, z);
  if (character === 'fox') {
    // The source's clasped hands settle beside the kimono, keeping a soft elbow curve.
    const front =
      smooth(0.13, 0.23, z) *
      (1 - smooth(0.15, 0.23, y)) *
      smooth(-0.05, 0.035, y);
    const side = smooth(-0.06, 0.06, x) * 2 - 1;
    out.x += side * 0.12 * front;
    const angle = 1.1 * front;
    const dy = y - 0.19,
      dz = z - 0.055;
    out.y = 0.19 + Math.cos(angle) * dy - Math.sin(angle) * dz;
    out.z = 0.055 + Math.sin(angle) * dy + Math.cos(angle) * dz;
  }
  return out;
}
