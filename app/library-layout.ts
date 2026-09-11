// A square A bay extends north; the existing game room keeps its south boundary.
export const libraryFurniture = {
  northLeft: { x: -3.55, z: -4.03, width: 1.6, depth: 0.64 },
  northRight: { x: 1.98, z: -4.03, width: 3.44, depth: 0.64 },
  eastShelves: { x: 4.06, z: 0.04, width: 0.64, depth: 8.12 },
  windowSeat: { x: -1.28, z: -3.86, width: 2.86, depth: 0.87 },
  desk: { x: 0.3, z: -0.25, width: 2.65, depth: 1.4 },
  deskChair: { x: 0.3, z: 1.25, width: 0.82, depth: 0.87 },
  armchair: { x: -2.35, z: 1.6, width: 1.3, depth: 1.3 },
  ottoman: { x: -2.35, z: 3, width: 0.93, depth: 0.75 },
  sideTable: { x: -1.28, z: 1.5, width: 0.52, depth: 0.52 },
  cart: { x: 1.65, z: 3.12, width: 1.1, depth: 0.64 },
} as const;
export const libraryLadderStops = [-2.55, -0.2, 2.3] as const;
// Reserve the whole swept area, including the leaning feet, at every ladder position.
export const libraryLadderLane = { x: 3.25, z: -0.1, width: 1.22, depth: 6.7 };
export const libraryDoor = {
  axis: 'x',
  at: 14,
  along: 1.75,
  a: 'corridor',
  b: 'library',
} as const;
export const libraryRoutes = [
  [
    [-4.5, 2.85],
    [-3.85, 2.85],
    [-3.85, 0.35],
    [-2.8, -0.25],
    [-1.8, -1.6],
    [-1.28, -2.9],
  ],
  [
    [-4.5, 2.85],
    [-3.7, 2.85],
    [-3.7, 3.85],
    [-1.1, 3.85],
    [-0.6, 2.5],
    [0.3, 2.3],
  ],
  [
    [-1.8, -1.6],
    [2.12, -1.6],
    [2.12, 0.9],
  ],
] as const;
