import { humanHeight } from './character-scale.mjs';

// The host belongs to the same miniature cast, including head-to-body ratio.
export const residentHeight = humanHeight;
export const residentScale = residentHeight / 1.3;
export const residentStride = 0.44;

export function residentLeg(
  distance: number,
  amount: number,
  side: number,
  thigh: number,
  shin: number,
) {
  const blend = Math.max(0, Math.min(1, amount));
  const cycle = residentStride / residentScale;
  const target = (index: number) => {
    // Start with one planted foot below the hips and the other lifting,
    // rather than spreading both legs abruptly at the first walking frame.
    const phase =
      (((distance / residentStride + 0.3 + index * 0.5) % 1) + 1) % 1;
    const swing = Math.max(0, (phase - 0.6) / 0.4);
    const recover =
      swing * swing * (3 - 2 * swing) -
      (2 / 3) * swing * (1 - swing) * (1 - 2 * swing);
    return {
      phase,
      z:
        cycle * 0.6 * (phase < 0.6 ? 0.5 - phase / 0.6 : recover - 0.5) * blend,
      lift: Math.sin(swing * Math.PI) ** 2 * 0.022 * blend,
    };
  };
  const feet = [target(0), target(1)],
    foot = feet[side];
  if (!blend) return { ...foot, hip: 0, knee: 0, ankle: 0, drop: 0 };
  const length = thigh + shin;
  // Let the support leg straighten below the hips. A constant pelvis drop
  // keeps both knees bent for the entire cycle and produces a crouching gait.
  const required = feet.map(
    (f) =>
      length - f.lift - Math.sqrt(length * length - f.z * f.z) + 0.0015 * blend,
  );
  const softMax = (a: number, b: number) =>
    (a + b + Math.sqrt((a - b) ** 2 + (0.0004 * blend) ** 2)) / 2;
  const drop = softMax(0, softMax(required[0], required[1]));
  const y = -length + drop + foot.lift;
  const reach = Math.min(
    length,
    Math.max(Math.abs(thigh - shin), Math.hypot(y, foot.z)),
  );
  const knee = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (reach * reach - thigh * thigh - shin * shin) / (2 * thigh * shin),
      ),
    ),
  );
  const hip =
    Math.atan2(-foot.z, -y) -
    Math.atan2(shin * Math.sin(knee), thigh + shin * Math.cos(knee));
  return { ...foot, hip, knee, ankle: -hip - knee, drop };
}

const ease = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

/** Action-local time: a greeting ends, and a sip has a lift, pause and return. */
export function residentGesture(kind: number, age: number, reduced = false) {
  const t = reduced ? 0 : Math.max(0, age);
  const sipTime = t % 10;
  const sip =
    kind === 2
      ? ease((sipTime - 2) / 1.3) * (1 - ease((sipTime - 4.8) / 1.4))
      : 0;
  const wave = kind === 6 ? 1 - ease((t - 1.8) / 0.8) : 0;
  return {
    sip,
    wave,
    waveOffset: Math.sin(t * 5.5) * 0.025 * wave,
    work: reduced ? 0 : Math.sin(t * 1.6) * 0.014,
    nod: kind === 8 ? ease(t / 0.8) * (1 - ease((t - 1.1) / 0.9)) * 0.045 : 0,
  };
}
