// 6.8 × 23.8: an east conservatory spanning the entire library/playroom/bar wing.
export const gardenFurniture = {
  readingSofa: { x: 0.2, z: -10.93, width: 3.3, depth: 1.12 },
  readingReturn: { x: 2.57, z: -9.61, width: 1.05, depth: 2.12 },
  readingTable: { x: 0.25, z: -8.23, width: 1.72, depth: 1.72 },
  bookcase: { x: -2.85, z: -10.25, width: 0.55, depth: 2.3 },
  readingPlanter: { x: 0.65, z: -6.22, width: 3.9, depth: 0.56 },
  lemonBench: { x: 0.6, z: -3.65, width: 2.66, depth: 2.66 },
  workbench: { x: 0.72, z: 0.12, width: 3.1, depth: 1.34 },
  plantShelf: { x: 2.95, z: -0.75, width: 0.58, depth: 5.5 },
  westPlanter: { x: -2.94, z: 0.3, width: 0.5, depth: 3.3 },
  basin: { x: 2.5, z: 2.64, width: 1.12, depth: 1.12 },
  loungePlanter: { x: 0.82, z: 4.16, width: 3.9, depth: 0.56 },
  chairA: { x: -1.1, z: 7.6, width: 1.38, depth: 1.38, yaw: 0.6 },
  chairB: { x: 1.95, z: 7.2, width: 1.38, depth: 1.38, yaw: -0.52 },
  loungeTable: { x: 0.65, z: 9.5, width: 1.72, depth: 1.72 },
  drinksCart: { x: 2.66, z: 9.87, width: 0.9, depth: 1.5 },
  picnicBasket: { x: 0.4, z: 11.08, width: 1.17, depth: 0.72 },
  southPalm: { x: 2.6, z: 11.26, width: 0.74, depth: 0.74 },
} as const;
export const gardenPortals = [
  { axis: 'x', at: 23, along: 2.15, a: 'library', b: 'garden' },
  { axis: 'x', at: 23, along: 9.25, a: 'gaming', b: 'garden' },
  { axis: 'x', at: 23, along: 14.35, a: 'bar', b: 'garden' },
] as const;
export const gardenRoutes = [
  [
    [-3.4, -4.15],
    [-2.25, -4.15],
    [-2.25, -7.1],
    [-1.28, -9.43],
  ],
  [
    [-2.25, -4.15],
    [-2.25, 2.95],
    [-3.4, 2.95],
  ],
  [
    [-2.25, 2.95],
    [-2.35, 5.25],
    [-2.65, 8.05],
    [-3.4, 8.05],
  ],
  [
    [-2.25, 2.95],
    [-1.25, 1.6],
    [0.72, 1.6],
  ],
  [
    [-2.65, 8.05],
    [-2.3, 9.65],
    [-1.1, 10.1],
  ],
] as const;
