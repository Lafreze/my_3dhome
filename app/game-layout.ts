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
  blocks: { x: -2.7, z: -2.57, width: 1.25, depth: 1.13 },
  snake: { x: -1.27, z: -2.57, width: 1.25, depth: 1.13 },
  pinball: { x: -3.42, z: -0.27, width: 1.22, depth: 2.05 },
  collection: { x: 1.0, z: -2.95, width: 2.4, depth: 0.62 },
  media: { x: 3.94, z: -0.1, width: 0.72, depth: 3.8 },
  sofa: { x: 1.46, z: 0.1, width: 1.25, depth: 2.85 },
  sideTable: { x: 1.65, z: 2.12, width: 0.7, depth: 0.7 },
  board: { x: -1.3, z: 2.02, width: 1.62, depth: 1.62 },
  stoolA: { x: -2.66, z: 2.12, width: 0.61, depth: 0.61 },
  stoolB: { x: 0.07, z: 2.12, width: 0.61, depth: 0.61 },
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
    [-1.3, -1.35],
    [-2.45, -1.55],
  ],
] as const;
