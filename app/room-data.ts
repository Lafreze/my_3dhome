import { newObjects } from './house-data';
export const objects = {
  ...newObjects,
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
  window: { name: '书房北窗', kind: 'N · 林地', action: '时间与天气' },
  stool: { name: '工作椅', kind: 'FURNITURE', action: '拉出 / 归位' },
  drawer: { name: '收藏抽屉', kind: 'DETAIL', action: '打开 / 收起' },
  camera: { name: '胶片相机', kind: 'PHOTOGRAPHY', action: '打开相册' },
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
export const defaultProfile: Profile = {
  name: 'SATORI',
  subtitle: 'PERSONAL STUDIO',
  about: '在这里，收藏创作、观察，以及日常的灵感。',
  projects: [
    {
      title: '静山之间',
      category: 'SPATIAL STUDY · 01',
      description:
        '关于空间、光线与安静的习作。以自然的层次，寻找恰到好处的留白。',
      url: '',
      image: '',
    },
    {
      title: '形与秩序',
      category: 'VISUAL STUDY · 02',
      description: '圆、线与平面之间的关系。一组探索节奏与平衡的视觉实验。',
      url: '',
      image: '',
    },
    {
      title: '日常切片',
      category: 'FIELD NOTES · 03',
      description: '把走过的地方、遇见的颜色，收进日常的观察笔记。',
      url: '',
      image: '',
    },
  ],
  photos: [],
};
export type RoomApi = {
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
  interact: (id: ObjectId) => void;
  dispose: () => void;
};
