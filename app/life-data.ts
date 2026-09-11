import type { RoomId } from './house-data';
import { rooms } from './house-data.ts';
import seatRoutes from '../config/visitor-routes.json' with { type: 'json' };

export type ActorId = 'resident' | 'cat' | 'rabbit' | 'bird' | 'robot';
export type Point = [number, number, number];
export type ActorState =
  | 'idle'
  | 'lookOutside'
  | 'listenMusic'
  | 'think'
  | 'walk'
  | 'rise'
  | 'settle'
  | 'sit'
  | 'type'
  | 'read'
  | 'brewCoffee'
  | 'cleanCup'
  | 'inspectArtwork'
  | 'drinkCoffee'
  | 'wave'
  | 'petCat'
  | 'lookAround'
  | 'hop'
  | 'groom'
  | 'sniff'
  | 'sleep'
  | 'hide'
  | 'land'
  | 'perch'
  | 'peck'
  | 'preen'
  | 'hopShort'
  | 'takeOff'
  | 'docked'
  | 'start'
  | 'cleaning'
  | 'avoid'
  | 'turn'
  | 'returnToDock'
  | 'charging'
  | 'stretch'
  | 'watchBird'
  | 'watchRabbit'
  | 'ride';
export type NavigationNode = {
  id: string;
  position: Point;
  rotation: number;
  allowedActors: ActorId[];
  posture: ActorState;
  room: RoomId;
  neighbors: string[];
  occupancy: string | null;
  interactionTarget: string;
  minStayTime: number;
  maxStayTime: number;
  seatId?: string;
};
const node = (
  id: string,
  room: RoomId,
  x: number,
  z: number,
  actors: ActorId[],
  posture: ActorState = 'idle',
  target = '',
  seatId?: string,
  yaw = 0,
): NavigationNode => ({
  id,
  room,
  position: [x, 0.085, z],
  rotation: yaw,
  allowedActors: actors,
  posture,
  neighbors: [],
  occupancy: null,
  interactionTarget: target,
  minStayTime: 20,
  maxStayTime: 60,
  seatId,
});
const ground: ActorId[] = ['resident', 'cat', 'rabbit', 'robot'];
// Positions are authored room-local approach points, never random destination coordinates.
// A seat is entered only after reaching its approach and rechecking the live seat anchor.
export const navigationNodes: NavigationNode[] = [
  node('library.entrance', 'library', -3.85, 2.85, [
    'resident',
    'cat',
    'rabbit',
  ]),
  node(
    'library.reading',
    'library',
    -1.28,
    -2.9,
    ['resident', 'cat', 'rabbit'],
    'lookAround',
    'libraryShelf',
  ),
  node('corridor.library', 'corridor', 0, 1.75 - rooms.corridor.z, [
    'resident',
    'cat',
    'rabbit',
  ]),
  node('bar.entrance', 'bar', -2, 1.9, ['resident', 'cat', 'rabbit']),
  node(
    'bar.lounge',
    'bar',
    0.65,
    -1.25,
    ['resident', 'cat', 'rabbit'],
    'lookAround',
    'barMix',
  ),
  node('corridor.gallery', 'corridor', 0, 9.2 - rooms.corridor.z, [
    'resident',
    'cat',
    'rabbit',
  ]),
  node('corridor.cafe', 'corridor', 0, 10.95 - rooms.corridor.z, [
    'resident',
    'cat',
    'rabbit',
  ]),
  node(
    'gaming.center',
    'gaming',
    -0.1,
    0.4,
    ['resident', 'cat', 'rabbit'],
    'lookAround',
    'arcadeSnake',
  ),
  node(
    'gaming.arcade',
    'gaming',
    -1.95,
    -1.22,
    ['resident'],
    'lookAround',
    'arcadeBlocks',
    undefined,
    Math.PI,
  ),
  node(
    'study.desk',
    'study',
    0.0,
    -1.25,
    ['resident'],
    'type',
    'computer',
    'study-work',
  ),
  node(
    'study.chair',
    'study',
    2.3,
    2.38,
    ['resident'],
    'read',
    'shelf',
    'study-reading',
  ),
  node(
    'study.bookshelf',
    'study',
    -1.7,
    -1.88,
    ['resident', 'cat', 'rabbit'],
    'read',
    'shelf',
  ),
  node('study.aisle', 'study', 2.65, 1.55, ['resident', 'cat', 'rabbit']),
  node('study.cat', 'study', 2.1, -3.1, ['cat'], 'sleep', 'window'),
  node('study.window', 'study', 1.6, -3.12, ['bird'], 'perch', 'window'),
  node(
    'living.sofa',
    'living',
    -1.78,
    0.55,
    ['resident'],
    'drinkCoffee',
    'livingSofa',
    'living-sofa-1',
  ),
  node(
    'living.recordPlayer',
    'living',
    2.75,
    -1.6,
    ['resident'],
    'idle',
    'livingRecord',
    undefined,
    Math.PI,
  ),
  node(
    'living.tvConsole',
    'living',
    -1.75,
    -1.75,
    ground,
    'idle',
    'television',
  ),
  node('living.aisle', 'living', -2.45, 1.75, ground),
  node('living.openFloor', 'living', 1.4, 2.5, ['cat', 'robot']),
  node('living.cat', 'living', 3.76, 0.68, ['cat'], 'sleep', 'livingWindow'),
  node(
    'living.window',
    'living',
    3.76,
    -0.5,
    ['bird'],
    'perch',
    'livingWindow',
  ),
  node(
    'bedroom.window',
    'bedroom',
    -3.27,
    1.35,
    ['cat', 'rabbit'],
    'sit',
    'bedroomWindow',
  ),
  node('bedroom.bedFoot', 'bedroom', 1.85, 1.72, ['cat', 'rabbit']),
  node(
    'bedroom.cat',
    'bedroom',
    -3.76,
    0.68,
    ['cat'],
    'sleep',
    'bedroomWindow',
  ),
  node(
    'bedroom.bird',
    'bedroom',
    -3.76,
    -0.6,
    ['bird'],
    'perch',
    'bedroomWindow',
  ),
  node(
    'gallery.bench',
    'gallery',
    -0.65,
    1.23,
    ['resident'],
    'sit',
    'galleryArt',
    'gallery-bench-1',
    Math.PI,
  ),
  node(
    'gallery.benchUnder',
    'gallery',
    -0.85,
    2.08,
    ['rabbit'],
    'sleep',
    'galleryArt',
  ),
  node(
    'gallery.leftPlinth',
    'gallery',
    -1.82,
    -0.25,
    ['resident', 'cat', 'rabbit'],
    'inspectArtwork',
    'galleryGame',
    undefined,
    -Math.PI / 2,
  ),
  node(
    'gallery.centerPlinth',
    'gallery',
    0.05,
    -1.58,
    ['resident', 'cat', 'rabbit'],
    'inspectArtwork',
    'gallerySculpture',
    undefined,
    Math.PI,
  ),
  node(
    'gallery.rightPlinth',
    'gallery',
    1.4,
    0.0,
    ['resident'],
    'inspectArtwork',
    'galleryCase',
    undefined,
    Math.PI / 2,
  ),
  node(
    'gallery.crownedRabbit',
    'gallery',
    2.65,
    -1.15,
    ['resident'],
    'inspectArtwork',
    'galleryRabbit',
  ),
  node('gallery.aisleWest', 'gallery', -1.75, 1.45, ground),
  node('gallery.aisleNorth', 'gallery', -1.7, -2.5, ground),
  node('gallery.aisleSouth', 'gallery', 1.6, 2.45, ground),
  node('gallery.cat', 'gallery', 3.76, 0.68, ['cat'], 'sleep', 'galleryWindow'),
  node(
    'cafe.barInside',
    'cafe',
    -5.18,
    -2.035,
    ['resident'],
    'brewCoffee',
    'cafeEspresso',
    undefined,
    Math.PI,
  ),
  node(
    'cafe.cups',
    'cafe',
    -3.9,
    -2.05,
    ['resident'],
    'cleanCup',
    'cafeEspresso',
    undefined,
    Math.PI,
  ),
  node(
    'cafe.pickup',
    'cafe',
    -2.4,
    -2.05,
    ['resident'],
    'brewCoffee',
    'cafePourOver',
    undefined,
    Math.PI,
  ),
  node(
    'cafe.window',
    'cafe',
    6.43,
    -2.85,
    ['resident'],
    'drinkCoffee',
    'cafeSeat',
    'cafe-banquette-1',
    -Math.PI / 2,
  ),
  node(
    'cafe.booth',
    'cafe',
    6.27,
    3.48,
    ['rabbit', 'cat'],
    'sniff',
    'cafeSeat',
  ),
  node('cafe.aisle1', 'cafe', -0.95, -2.5, ground),
  node('cafe.aisle2', 'cafe', -0.95, 1.45, ground),
  node('cafe.aisle3', 'cafe', 3.15, -3.18, ground),
  node('cafe.aisle4', 'cafe', 3.15, 3.3, ground),
  node('cafe.cat', 'cafe', 7.18, -2.15, ['cat'], 'sleep', 'cafeWindow'),
  node('cafe.bird', 'cafe', 5.3, 3.78, ['bird'], 'perch', 'cafeWindow'),
  node('robot.dock', 'cafe', -2.5, 3.45, ['robot'], 'docked', 'charger'),
];
const adjacent: Record<RoomId, RoomId[]> = {
  study: ['living', 'bedroom'],
  living: ['study', 'gallery'],
  bedroom: ['study', 'gallery', 'cafe'],
  gallery: ['living', 'bedroom', 'cafe', 'corridor'],
  cafe: ['bedroom', 'gallery', 'corridor'],
  corridor: ['gallery', 'cafe', 'gaming', 'bar', 'library'],
  library: ['corridor'],
  bar: ['corridor'],
  gaming: ['corridor'],
};
// NPCs and online guests share the same validated furniture access points.
for (const n of navigationNodes) {
  const seat =
    n.seatId && seatRoutes.nodes[n.seatId as keyof typeof seatRoutes.nodes];
  if (!seat) continue;
  n.position = [
    seat.approach[0] - rooms[n.room].x,
    0.085,
    seat.approach[2] - rooms[n.room].z,
  ];
  n.rotation = seat.yaw + Math.PI;
}
for (const n of navigationNodes)
  n.neighbors = navigationNodes
    .filter(
      (o) =>
        o !== n &&
        (o.room === n.room || adjacent[n.room].includes(o.room)) &&
        o.allowedActors.some((a) => n.allowedActors.includes(a)),
    )
    .map((o) => o.id);
export const actorSpecs = {
  resident: {
    radius: 0.29,
    speed: 0.62,
    start: 'study.desk',
    name: '小屋主理人',
  },
  cat: { radius: 0.28, speed: 0.21, start: 'study.cat', name: '小黑猫' },
  rabbit: {
    radius: 0.25,
    speed: 0.25,
    start: 'gallery.centerPlinth',
    name: '白兔',
  },
  bird: { radius: 0.09, speed: 0, start: 'study.window', name: '窗边小鸟' },
  robot: { radius: 0.25, speed: 0.27, start: 'robot.dock', name: '扫地机器人' },
} as const;
export const eventRules = {
  rabbit: {
    visitChance: 0.42,
    cooldown: 420,
    duration: [60, 180],
    firstDelay: 45,
  },
  bird: {
    chance: { morning: 0.65, afternoon: 0.3, sunset: 0.14, night: 0 },
    cooldown: 150,
    roomCooldown: 240,
    duration: [10, 30],
  },
  resident: { cooldown: 24, duration: [20, 60] },
  petCat: { chance: 0.2, cooldown: 180, duration: 6 },
  robotRide: { chance: 0.18, cooldown: 300, duration: 12 },
  animalMeeting: { chance: 0.25, cooldown: 120, duration: 6 },
  greeting: { cooldown: 8, duration: 3 },
} as const;
export const collectionCards = {
  'story.pressedLeaf': {
    title: '手记里的叶子',
    mark: '叶',
    hint: '书桌上的小手记，夹着一片安静的绿。',
  },
  'story.drawer': {
    title: '未寄出的明信片',
    mark: '笺',
    hint: '收藏抽屉里还有一封没寄出的问候。',
  },
  'coffee.espresso': {
    title: '一口浓缩',
    mark: '浓',
    hint: '亲手完成一杯浓缩。',
  },
  'coffee.latte': {
    title: '奶泡上的午后',
    mark: '奶',
    hint: '让奶香留住片刻。',
  },
  'coffee.filter': {
    title: '慢慢手冲',
    mark: '滤',
    hint: '等待一杯清透的回甘。',
  },
  'story.book': { title: '书中的夹页', mark: '页', hint: '翻开一本创作手记。' },
  'story.record': {
    title: '唱片里的灵感',
    mark: '音',
    hint: '听一段旋律，再看一眼唱片。',
  },
  'story.gallery': {
    title: '作品背后的故事',
    mark: '作',
    hint: '读一篇作品介绍。',
  },
  'house.postcard': {
    title: '我的小屋明信片',
    mark: '影',
    hint: '用书桌上的相机留住此刻。',
  },
  'house.rain': {
    title: '雨天明信片',
    mark: '雨',
    hint: '下雨时，拍下小屋的一角。',
  },
  'visitor.rabbit.first': {
    title: '白兔来访',
    mark: '兔',
    hint: '白色的影子似乎喜欢安静的角落。',
  },
  'visitor.rabbit.gallery': {
    title: '展厅里的白影',
    mark: '展',
    hint: '长凳旁，也许藏着一位安静的观众。',
  },
  'visitor.rabbit.cafe': {
    title: '咖啡香里的兔脚印',
    mark: '珈',
    hint: '卡座边的咖啡香，偶尔留住小小来客。',
  },
  'visitor.rabbit.bedroom': {
    title: '窗边的午睡',
    mark: '眠',
    hint: '柔软的光，适合一次短暂的停留。',
  },
  'visitor.bird.window': {
    title: '窗边来客',
    mark: '羽',
    hint: '完整看完一次抵达与告别。',
  },
  'resident.firstGreeting': {
    title: '初次问候',
    mark: '杯',
    hint: '和正在忙碌的主理人打个招呼。',
  },
  'cat.robotRide': {
    title: '小猫专车',
    mark: '猫',
    hint: '地板上偶尔会经过一团移动的黑绒。',
  },
} as const;
export type CollectionId = keyof typeof collectionCards;
export type CollectionRecord = {
  collectedAt: string;
  sourceActor: ActorId | 'house';
  sourceRoom: RoomId;
  version: 1;
};
export type CollectionData = Partial<Record<CollectionId, CollectionRecord>>;
export const lifeStorageKey = 'kuro-life-collection-v1';
