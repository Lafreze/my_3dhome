// Metres = scene units × 0.625. The north openings continue the existing room aisles.
export const cafeLayout = {
  counter: { x: -4.7, z: -1.05, width: 5.8, depth: 1.2 },
  backCounter: { x: -4.9, z: -3.42, width: 5.4, depth: 0.7 },
  communal: { x: 1.1, z: 0.25, width: 2.65, depth: 1.25 },
  banquette: { x: 7.22, z: 0.4, width: 0.98, depth: 5.8 },
  loungeTable: { x: -5.65, z: 2.2, width: 0.95, depth: 0.95 },
} as const;
// Countertop items use room coordinates; checkout stays outside the glazing and door tracks.
export const cafeCounterItems = {
  espresso: { x: -5.18, z: -1.08, width: 1.56, depth: 0.82 },
  grinder: { x: -6.44, z: -1.07, width: 0.46, depth: 0.6 },
  pastry: { x: -3, z: -1.1, width: 1.04, depth: 0.94 },
  register: { x: -2.18, z: -0.9, width: 0.5, depth: 0.29 },
  cardReader: { x: -2.18, z: -0.59, width: 0.23, depth: 0.28 },
  cups: { x: -3.9, z: -1.41, width: 0.26, depth: 0.26 },
  napkins: { x: -3.9, z: -0.91, width: 0.38, depth: 0.27 },
} as const;
export const cafeFloorPlants = {
  fern: { x: -7.3, z: 3.28, width: 0.66, depth: 0.66 },
  ficus: { x: 2.2, z: 3.4, width: 0.58, depth: 0.58 },
  flowers: { x: 7.25, z: 3.59, width: 0.34, depth: 0.34 },
} as const;
export const cafeBistroTables = [-1.65, 0.45, 2.55].map((z) => ({
  x: 5.42,
  z,
  width: 1.15,
  depth: 1.15,
}));
// Positive yaw turns a north-facing chair towards west; every chair faces its table.
export const cafeChairs = [
  ...cafeBistroTables.map((t) => ({
    x: 4.21,
    z: t.z,
    yaw: -Math.PI / 2,
    style: 'dining',
    table: [t.x, t.z],
  })),
  ...[-0.75, 0.75].flatMap((dx) =>
    [-1, 1].map((side) => ({
      x: 1.1 + dx,
      z: 0.25 + side * 1.2,
      yaw: side === 1 ? 0 : Math.PI,
      style: 'dining',
      table: [1.1 + dx, 0.25],
    })),
  ),
  { x: -7, z: 2.1, yaw: -Math.PI / 2, style: 'lounge', table: [-5.65, 2.2] },
  { x: -4.3, z: 2.35, yaw: Math.PI / 2, style: 'lounge', table: [-5.65, 2.2] },
] as const;
export const cafeRoutes = [
  [
    [-1.35, -4],
    [-0.9, -2.5],
    [-0.9, 1.4],
    [-1.35, 3.9],
  ],
  [
    [5.6, -4],
    [5.6, -3.2],
    [3.25, -3.2],
    [3.25, 3.25],
  ],
  [
    [-0.9, -2.5],
    [-1.2, -2.45],
    [-4.7, -2.45],
    [-6.9, -2.45],
  ],
  [
    [-0.9, 0.25],
    [-2.8, 0.25],
    [-6.8, 0.25],
  ],
] as const;
