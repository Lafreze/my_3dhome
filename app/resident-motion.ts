import { sampleRigLeg } from './rig-gait.mjs';

// The remodel is authored at 1.30; furniture uses a taller scene scale.
// Keep this separate from the visitors' deliberately small proportions.
export const residentHeight = 2.2;
export const residentScale = residentHeight / 1.3;
export const residentStride = 0.72;

export function residentLeg(distance: number, amount: number, side: number) {
  return sampleRigLeg(
    distance / residentScale,
    amount,
    side,
    0.245,
    0.21,
    residentStride / residentScale,
    0.018,
    0.022,
  );
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
