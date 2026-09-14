import type * as T from 'three';
import type { RoomAssets } from './asset-loading';
import { paintingTexture } from './painting-textures';
export const corridorArtworks = [
  {
    id: 'fern',
    title: '苔桥与溪流',
    medium: '林间油画',
    width: 0.72,
    height: 1.03,
    paper: '#e9dfc5',
    frame: '#846d49',
  },
  {
    id: 'coast',
    title: '海岸晨光',
    medium: '海岸水彩',
    width: 0.92,
    height: 0.7,
    paper: '#dedfd2',
    frame: '#e1d6bd',
  },
  {
    id: 'citrus',
    title: '花园石阶',
    medium: '静物油画',
    width: 0.72,
    height: 0.89,
    paper: '#b8c1b0',
    frame: '#675846',
  },
  {
    id: 'tram',
    title: '雨夜灯巷',
    medium: '街巷油画',
    width: 0.81,
    height: 1.01,
    paper: '#d9c9ab',
    frame: '#8a6548',
  },
  {
    id: 'moon',
    title: '月下湖泊',
    medium: '月夜油画',
    width: 0.78,
    height: 0.93,
    paper: '#313f50',
    frame: '#aa9364',
  },
  {
    id: 'heron',
    title: '湖岸小舟',
    medium: '湖畔油画',
    width: 0.66,
    height: 1.1,
    paper: '#e7e2d2',
    frame: '#555b50',
  },
  {
    id: 'jazz',
    title: '檐下灯火',
    medium: '街巷油画',
    width: 0.76,
    height: 0.98,
    paper: '#bd805a',
    frame: '#3e4743',
  },
  {
    id: 'tiles',
    title: '林间小径',
    medium: '风景油画',
    width: 0.88,
    height: 0.72,
    paper: '#e9d8b7',
    frame: '#947253',
  },
] as const;
export function corridorArtTexture(
  index: number,
  textures: T.Texture[],
  assets: RoomAssets,
) {
  const spec = corridorArtworks[index];
  const ids = [
    'forest-stream',
    'coastal-dawn',
    'coastal-dawn',
    'rainy-lanterns',
    'moonlit-water',
    'moonlit-water',
    'rainy-lanterns',
    'forest-stream',
  ];
  const panels = [3, 1, 3, 1, 2, 2, 1, 3],
    crops = [0, 0, 0, 0, 1, 0, 0, 2];
  return paintingTexture(
    assets,
    'corridor',
    'art.' + ids[index],
    textures,
    spec.width / spec.height,
    crops[index],
    panels[index],
  );
}
