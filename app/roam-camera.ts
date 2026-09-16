/** Fixed heading keeps screen directions predictable while distance stays adjustable. */
export const defaultRoamZoom = 0.78;
export function adjustRoamZoom(current: number, delta: number) {
  if (!Number.isFinite(current)) current = defaultRoamZoom;
  if (!Number.isFinite(delta)) delta = 0;
  return Math.max(
    0.46,
    Math.min(1.3, current * Math.exp(Math.max(-1, Math.min(1, delta)))),
  );
}
