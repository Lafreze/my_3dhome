const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
/** Slide the hips to the open edge before straightening the short legs.
 * Reversing this curve folds the legs before moving back onto the cushion. */
export function sampleSeatTransfer(
  seat,
  approach,
  progress,
  entering,
  standingY,
) {
  const t = entering ? 1 - clamp(progress) : clamp(progress);
  const travel = ease(t),
    stand = ease((t - 0.28) / 0.72);
  return {
    position: [
      seat[0] + (approach[0] - seat[0]) * travel,
      seat[1] +
        (standingY - seat[1]) * stand +
        Math.sin(Math.PI * stand) * 0.025,
      seat[2] + (approach[2] - seat[2]) * travel,
    ],
    stand,
  };
}
