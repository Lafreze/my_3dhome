import type { Character } from './visitor-appearance';
// Left hand stays free of the original bear figure's right-hand bag.
export const seatedHand: Record<Character, [number, number, number]> = {
  bear: [-0.2, 0.018, 0.18],
  cat: [-0.2, 0.06, 0.22],
  fox: [-0.11, 0.075, 0.23],
  noir: [-0.19, 0.1, 0.25],
  rose: [-0.17, 0.09, 0.21],
};
export function heldHand(
  character: Character,
  neck: number,
  kind: number,
): [number, number, number] {
  return kind === 1 ? [-0.07, neck * 0.65, 0.3] : [-0.06, neck + 0.09, 0.27];
}
