// One four-beat walking cycle, driven by ground distance rather than elapsed time.
export const catScale = 0.6;
// Short steps fit the supplied kitten's stubby legs; a long generic stride tears its belly.
export const catStride = 0.14;
export const catStance = 0.72;
export const catRiseTime = 0.65;
export const catSettleTime = 0.55;
const offsets = [0.25, 0.75, 0, 0.5]; // left fore, right fore, left hind, right hind
export function sampleCatPaw(distance: number, leg: number) {
  const phase = (((distance / catStride + offsets[leg]) % 1) + 1) % 1;
  const reach = (catStride * catStance) / catScale;
  if (phase < catStance)
    return { z: reach * (phase / catStance - 0.5), y: 0, grounded: true };
  const swing = (phase - catStance) / (1 - catStance);
  const ease = swing * swing * (3 - 2 * swing);
  return {
    z: reach * (0.5 - ease),
    y: Math.sin(swing * Math.PI) * 0.048,
    grounded: false,
  };
}
