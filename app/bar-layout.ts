// The former B bay: 9 × 8, directly opposite the café across EAST WALK.
export const barFurniture = {
  backbar: { x: -2.25, z: -3.46, width: 4.15, depth: 0.82 },
  counter: { x: -2.18, z: -0.55, width: 4.3, depth: 0.85 },
  return: { x: -3.96, z: -2.01, width: 0.74, depth: 2.07 },
  boothNorth: { x: 2.55, z: -3.45, width: 3.04, depth: 0.82 },
  boothEast: { x: 3.8, z: -1.9, width: 0.83, depth: 2.24 },
  tableNorth: { x: 1.73, z: -2.12, width: 0.98, depth: 0.98 },
  tableEast: { x: 1.85, z: -0.91, width: 1.02, depth: 1.02 },
  record: { x: -2.52, z: 3.5, width: 1.8, depth: 0.64 },
  umbrellas: { x: -4.03, z: 3.37, width: 0.45, depth: 0.45 },
} as const;
export const barStools = [-3.67, -2.65, -1.63, -0.61].map((x, i) => ({
  x,
  z: 0.69,
  width: 0.61,
  depth: 0.61,
  id: `bar-stool-${i + 1}`,
}));
export const barDartLane = { x: 2.4, z: 2.35, width: 3.8, depth: 1.75 };
export const barDoor = {
  axis: 'x',
  at: 14,
  along: 16.1,
  a: 'corridor',
  b: 'bar',
} as const;
export const barRoutes = [
  [
    [-4.5, 1.9],
    [-3.6, 1.9],
    [-1, 1.9],
    [0.08, 1.9],
    [0.08, 1.15],
    [0.65, 0.8],
  ],
  [
    [0.65, 0.8],
    [0.65, -1.15],
    [0.65, -2.1],
  ],
  [
    [-3.6, 1.9],
    [-2.52, 2.65],
  ],
] as const;
