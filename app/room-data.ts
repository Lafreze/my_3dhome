import houseDefaults from '../config/house-defaults.json';
import { newObjects } from './house-data';
export const objects = {
  studyNotes: { name: '书桌便签', kind: 'NOTES', action: '看看 / 留句话' },
  livingNotes: { name: '茶几便签', kind: 'NOTES', action: '看看 / 留句话' },
  bedroomNotes: { name: '床边便签', kind: 'NOTES', action: '看看 / 留句话' },
  galleryNotes: { name: '观展便签', kind: 'NOTES', action: '看看 / 留句话' },
  cafeNotes: { name: '咖啡便签', kind: 'NOTES', action: '看看 / 留句话' },
  ...newObjects,
  deskFan: { name: '摇头小风扇', kind: 'BREEZE', action: '开关风扇' },
  deskJournal: {
    name: '压叶手记',
    kind: 'FIELD NOTES',
    action: '翻开 / 合上手记',
  },
  studyCurtains: { name: '书房窗帘', kind: 'LINEN', action: '开合窗帘' },
  studyArt1: { name: '书房画作一', kind: 'ART', action: '查看 / 更换画作' },
  studyArt2: { name: '书房画作二', kind: 'ART', action: '查看 / 更换画作' },
  studyArt3: { name: '书房画作三', kind: 'ART', action: '查看 / 更换画作' },
  bed: { name: '亚麻沙发', kind: 'LOUNGE', action: '更换织物' },
  desk: { name: '木作工作台', kind: 'WORKSPACE', action: '浏览作品' },
  computer: { name: '作品工作站', kind: 'WEB', action: '电脑设置' },
  lamp: { name: '蘑菇灯', kind: 'LIGHT', action: '切换灯光' },
  taskLamp: { name: '折臂工作灯', kind: 'TASK LIGHT', action: '开关工作灯' },
  deskPlant: { name: '桌面小绿植', kind: 'BOTANICAL', action: '浇水' },
  shelfPlant: { name: '书柜小绿植', kind: 'BOTANICAL', action: '浇水' },
  frame: { name: '作品墙', kind: 'GALLERY', action: '展开作品' },
  shelf: { name: '灵感藏书', kind: 'LIBRARY', action: '翻开手记' },
  chair: { name: '皮革阅读椅', kind: 'READING', action: '更换皮革' },
  coffee: { name: '手冲咖啡', kind: 'COFFEE', action: '续一杯' },
  plant: { name: '窗边绿植', kind: 'BOTANICAL', action: '浇水' },
  rug: { name: '羊毛编织毯', kind: 'TEXTILE', action: '更换配色' },
  record: { name: '黑胶唱片机', kind: 'LISTENING', action: '播放 / 暂停' },
  window: { name: '书房北窗', kind: 'N · 水岸花园', action: '时间与天气' },
  stool: { name: '工作椅', kind: 'FURNITURE', action: '拉出 / 归位' },
  drawer: { name: '收藏抽屉', kind: 'DETAIL', action: '打开 / 收起' },
  camera: { name: '胶片相机', kind: 'PHOTOGRAPHY', action: '拍张明信片' },
  sculpture: { name: '平衡练习', kind: 'OBJECT', action: '转动雕塑' },
  about: { name: '关于我', kind: 'PORTRAIT', action: '查看名片' },
  floor: { name: '橡木地板', kind: 'ARCHITECTURE', action: '回到全景' },
  wall: { name: '灰泥墙面', kind: 'ARCHITECTURE', action: '回到全景' },
} as const;
export type ObjectId = keyof typeof objects;
export type Project = {
  title: string;
  category: string;
  description: string;
  url: string;
  image: string;
};
export type Profile = {
  name: string;
  subtitle: string;
  about: string;
  projects: Project[];
  photos: string[];
};
export const defaultProfile: Profile = houseDefaults.profile;
export type RoomApi = {
  barSnapshot: () => import('./bar-state').BarSnapshot;
  prepareCocktail: (drink: import('./bar-state').BarDrink) => boolean;
  clearCocktail: () => void;
  setBarRecord: (index: number | null) => void;
  setBarDarts: (hits: import('./bar-state').DartHit[]) => void;
  setGameScreen: (
    id: 'blocks' | 'snake',
    canvas: HTMLCanvasElement | null,
  ) => void;
  setGameBoard: (cells: import('./game-engine').Stone[]) => void;
  setGameRecords: (records: import('./game-engine').GameRecords) => void;
  visitorStatus: (id: string) => string;
  prepareCoffee: (drink: import('./coffee-state').Drink) => boolean;
  clearCoffee: () => void;
  coffeeSnapshot: () => import('./coffee-state').CoffeeSnapshot;
  capture: () => string;
  setAppearance: (value: import('./studio-settings').Appearance) => void;
  setCameraMode: (mode: 'orbit' | 'pan') => void;
  setLifePaused: (paused: boolean) => void;
  setLifeAudio: (context: AudioContext | null) => void;
  greetResident: () => void;
  lifeSnapshot: () => unknown;
  retryAssets: () => void;
  setVisitors: (visitors: import('./seat-data').Visitor[], me: string) => void;
  focusSeat: (id: string) => void;
  setView: (view: import('./house-data').HouseView) => void;
  setTelevision: (on: boolean, source?: string) => void;
  setComputerScreen: (element: HTMLElement | null) => void;
  setComputerPower: (on: boolean) => void;
  setWallPictures: (pictures: Record<string, string>) => void;
  setTVScreen: (element: HTMLElement | null) => void;
  reset: () => void;
  zoom: (direction: number) => void;
  focus: (id: ObjectId) => void;
  setEnvironment: (value: import('./environment-data').Environment) => void;
  setLamp: (value: boolean) => void;
  setMusic: (value: boolean) => void;
  setArtwork: (images: string[]) => void;
  setProjects: (projects: Project[]) => void;
  interact: (id: ObjectId, detail?: 'appearance') => void;
  dispose: () => void;
};
