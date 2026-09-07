// One scene unit represents 0.625 m. Footprints include arms/backs, not just legs.
// +Z is the open entrance; work chairs face -Z, lounge seats face local +Z.
export const METRES_PER_UNIT = 0.625;
export const FLOOR_Y = 0.078;
export const layout = {
  desk: { x: 1.32, z: -2.34, yaw: 0, width: 2.75, depth: 1.1 },
  stool: { x: 0.93, z: -1.22, yaw: 0, width: 0.86, depth: 0.96 },
  bed: { x: -2.91, z: 0.67, yaw: Math.PI / 2, width: 3.12, depth: 1.36 },
  coffee: { x: -0.83, z: 1.0, yaw: 0, width: 1.48, depth: 1.26 },
  chair: {
    x: 1.15,
    z: 1.84,
    yaw: Math.atan2(-1.98, -0.84),
    width: 1.18,
    depth: 1.25,
  },
  shelf: { x: -2.46, z: -2.83, yaw: 0, width: 2.34, depth: 0.63 },
  lamp: { x: -2.91, z: 2.78, yaw: 0, width: 0.7, depth: 0.68 },
  record: { x: 3.28, z: -0.37, yaw: -Math.PI / 2, width: 1.72, depth: 0.7 },
  plant: { x: 3.2, z: -2.56, yaw: 0, width: 0.58, depth: 0.58 },
} as const;
export type PlacedId = keyof typeof layout;
export const workChairTravel = 0.48;
export const drawerTravel = 0.51;
// Main route is kept separate from the seated conversation zone.
export const circulation = [
  [2.65, 3.2],
  [2.65, 1.3],
  [1.96, 0.54],
  [1.65, 0.2],
] as const;
