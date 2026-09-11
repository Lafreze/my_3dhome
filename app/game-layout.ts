// The main house stays on its original grid. Every expansion opens onto EAST WALK.
export const portalDestinations = {
  gameExitDoor: 'corridor',
  cafeEastDoor: 'corridor',
  galleryEastDoor: 'corridor',
  corridorGameDoor: 'gaming',
  corridorCafeDoor: 'cafe',
  corridorGalleryDoor: 'gallery',
} as const;
export const gameFurniture = {
  blocks: { x: -1.95, z: -2.57, width: 1.25, depth: 1.13 },
  snake: { x: -0.52, z: -2.57, width: 1.25, depth: 1.13 },
  pinball: { x: -3.52, z: -2.17, width: 1.22, depth: 2.05 },
  collection: { x: 1.77, z: -2.95, width: 2.4, depth: 0.62 },
  media: { x: 3.94, z: -0.1, width: 0.72, depth: 3.8 },
  sofa: { x: 1.73, z: 0.1, width: 1.25, depth: 2.85 },
  sideTable: { x: 1.95, z: 2.12, width: 0.7, depth: 0.7 },
  board: { x: -1.3, z: 2.02, width: 1.62, depth: 1.62 },
  stoolA: { x: -2.66, z: 2.12, width: 0.61, depth: 0.61 },
  stoolB: { x: 0.07, z: 2.12, width: 0.61, depth: 0.61 },
} as const;
// Standing space is part of the layout, in addition to each cabinet's footprint.
export const gameApproaches = {
  blocks: { x: -1.95, z: -1.22, width: 0.9, depth: 0.9 },
  snake: { x: -0.52, z: -1.22, width: 0.9, depth: 0.9 },
  pinball: { x: -3.52, z: -0.35, width: 0.9, depth: 0.9 },
} as const;
export const expansionPortals = [
  { axis: 'x', at: 12, along: 9.2, a: 'gallery', b: 'corridor' },
  { axis: 'x', at: 12, along: 10.95, a: 'cafe', b: 'corridor' },
  { axis: 'x', at: 14, along: 9.2, a: 'corridor', b: 'gaming' },
] as const;
export const expansionReservations = [
  {
    x: 18.5,
    z: 0,
    width: 9,
    depth: 6.8,
    name: '预留 A · 音乐 / 影音',
    doorZ: 1.75,
  },
  {
    x: 18.5,
    z: 14.2,
    width: 9,
    depth: 8,
    name: '预留 B · 手作 / 收藏',
    doorZ: 16.1,
  },
] as const;
export const gameRoutes = [
  [
    [-4.5, 2.4],
    [-3.5, 2.4],
    [-3.5, 1.35],
    [-2.6, 1.35],
    [-2.3, 0.7],
    [-0.1, 0.4],
    [-0.1, -1.35],
  ],
  [
    [-0.1, -1.35],
    [-0.52, -1.22],
    [-1.95, -1.22],
  ],
  [
    [-3.5, 1.35],
    [-3.52, -0.35],
  ],
  [
    [-0.1, -1.35],
    [0.55, -1.35],
    [0.55, -1.95],
    [2.8, -1.95],
    [2.8, 0.8],
  ],
] as const;
