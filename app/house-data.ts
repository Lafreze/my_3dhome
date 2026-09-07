export const rooms = {
  study: { name: '书房', english: 'THE STUDY', x: 0, z: 0, number: '01' },
  living: {
    name: '客厅',
    english: 'THE LIVING ROOM',
    x: 8,
    z: 0,
    number: '02',
  },
  bedroom: { name: '卧室', english: 'THE BEDROOM', x: 0, z: 6.8, number: '03' },
  gallery: {
    name: '展示区',
    english: 'THE GALLERY',
    x: 8,
    z: 6.8,
    number: '04',
  },
} as const;
export type RoomId = keyof typeof rooms;
export type HouseView = RoomId | 'overview' | 'plan';
export const newObjects = {
  television: { name: '家庭影院', kind: 'CINEMA', action: '打开电视' },
  livingSofa: { name: '模块沙发', kind: 'LOUNGE', action: '更换织物' },
  switch: { name: 'Switch 游戏机', kind: 'PLAY', action: '取下 / 装回手柄' },
  console: { name: '游戏主机', kind: 'CONSOLE', action: '开机 / 待机' },
  controller: { name: '无线手柄', kind: 'CONTROLLER', action: '更换配色' },
  livingLamp: { name: '弧线落地灯', kind: 'LIGHT', action: '开灯 / 关灯' },
  mediaDrawer: { name: '游戏收藏', kind: 'COLLECTION', action: '打开 / 收起' },
  livingWindow: { name: '客厅东窗', kind: 'E · 街巷', action: '时间与天气' },
  sleepBed: { name: '柔软的床', kind: 'REST', action: '更换床品' },
  bedsideLamp: { name: '床头灯', kind: 'LIGHT', action: '开灯 / 关灯' },
  wardrobe: { name: '木作衣柜', kind: 'WARDROBE', action: '打开 / 合上柜门' },
  bedroomWindow: { name: '卧室西窗', kind: 'W · 庭院', action: '时间与天气' },
  bedroomBook: { name: '睡前读物', kind: 'READING', action: '翻开手记' },
  galleryArt: { name: '个人作品展', kind: 'SELECTED WORK', action: '浏览作品' },
  galleryCase: { name: '物件档案', kind: 'ARCHIVE', action: '打开 / 合上展罩' },
  gallerySculpture: { name: '环形习作', kind: 'SCULPTURE', action: '旋转展台' },
  galleryLight: { name: '展览照明', kind: 'LIGHT', action: '开灯 / 关灯' },
  galleryWindow: { name: '展厅东窗', kind: 'E · 前庭', action: '时间与天气' },
} as const;
export const objectRooms: Record<keyof typeof newObjects, RoomId> = {
  television: 'living',
  livingSofa: 'living',
  switch: 'living',
  console: 'living',
  controller: 'living',
  livingLamp: 'living',
  mediaDrawer: 'living',
  livingWindow: 'living',
  sleepBed: 'bedroom',
  bedsideLamp: 'bedroom',
  wardrobe: 'bedroom',
  bedroomWindow: 'bedroom',
  bedroomBook: 'bedroom',
  galleryArt: 'gallery',
  galleryCase: 'gallery',
  gallerySculpture: 'gallery',
  galleryLight: 'gallery',
  galleryWindow: 'gallery',
};
export function roomForObject(id: string): RoomId {
  return objectRooms[id as keyof typeof objectRooms] ?? 'study';
}

// Local footprints in scene units (0.625 m), including furniture depth and cushions.
export const houseFurniture = {
  living: {
    sofa: { x: 0.55, z: 0.85, width: 3.55, depth: 1.38, facing: [0, -1] },
    media: { x: 0.45, z: -2.74, width: 4.55, depth: 0.72 },
    table: { x: 0.55, z: -0.75, width: 1.75, depth: 0.83 },
    lamp: { x: 2.95, z: 1.08, width: 0.55, depth: 0.55 },
  },
  bedroom: {
    bed: { x: -0.5, z: -0.3, width: 2.9, depth: 3.65 },
    wardrobe: { x: 3.49, z: -0.25, width: 0.84, depth: 2.55 },
    bench: { x: -0.5, z: 2.22, width: 2.28, depth: 0.56 },
    leftNightstand: { x: -2.55, z: -1.94, width: 0.66, depth: 0.69 },
    rightNightstand: { x: 1.54, z: -1.94, width: 0.66, depth: 0.69 },
  },
  gallery: {
    sculpture: { x: 0.1, z: -0.45, width: 1.0, depth: 1.0 },
    case: { x: 2.5, z: 0.2, width: 0.82, depth: 1.7 },
    bench: { x: -0.1, z: 2.1, width: 2.25, depth: 0.67 },
    catalogue: { x: -2.9, z: -0.15, width: 0.92, depth: 0.83 },
  },
} as const;
