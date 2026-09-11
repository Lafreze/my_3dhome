import * as T from 'three';
export const spineSubjects = [
  '植物标本',
  '山野步道',
  '夜空观察',
  '海岸地图',
  '周末厨房',
  '建筑手册',
  '陶艺笔记',
  '纸上花园',
  '城中漫步',
  '鸟类速写',
  '旧时唱片',
  '短篇小说',
  '旅人来信',
  '水彩习作',
  '四季诗选',
  '木作入门',
  '咖啡札记',
  '天文年历',
  '庭院手记',
  '摄影随笔',
  '音乐小史',
  '服饰图录',
  '石头收藏',
  '灯塔日志',
  '昆虫图鉴',
  '器物之美',
  '电影剪影',
  '剧场来客',
  '字母练习',
  '花纹档案',
  '民间故事',
  '河流日记',
  '南方食记',
  '纺织图谱',
  '帆船与海',
  '香草厨房',
  '城市切片',
  '版画小集',
  '博物游记',
  '玻璃工艺',
  '桥梁速写',
  '纸页装帧',
  '钟表机械',
  '花园色谱',
  '古道行记',
  '窗边小说',
  '日落记事',
  '海岛书简',
];
export const bindingColors = [
  '#63715b',
  '#a77a5d',
  '#697a89',
  '#967a90',
  '#c7b998',
  '#824f46',
  '#6d8b85',
  '#c3a25c',
  '#554d55',
  '#9b9b81',
  '#c1b19d',
  '#47646a',
];
type SpineAtlas = {
  material: T.MeshStandardMaterial;
  geometry: (w: number, h: number, index: number) => T.PlaneGeometry;
};
// Rooms share one atlas within a scene; a fresh scene owns fresh GPU resources.
const atlases = new WeakMap<T.Texture[], SpineAtlas>();
export function createSpineAtlas(
  textures: T.Texture[],
  materials: T.Material[],
) {
  const existing = atlases.get(textures);
  if (existing) return existing;
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 4096;
  const c = cv.getContext('2d')!;
  const cols = 16,
    rows = 32,
    tw = 64,
    th = 128,
    letters = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  for (let n = 0; n < 512; n++) {
    const x = (n % cols) * tw,
      y = Math.floor(n / cols) * th;
    c.fillStyle =
      bindingColors[(n * 7 + Math.floor(n / 12)) % bindingColors.length];
    c.fillRect(x, y, tw, th);
    c.fillStyle = n % 4 === 0 ? '#403b31' : '#e9dcc0';
    if (n % 4 === 0) {
      c.fillStyle = '#dcd1b5';
      c.fillRect(x + 9, y + 17, 46, 92);
      c.fillStyle = '#4d534b';
    }
    c.font = `${n % 3 === 0 ? 'bold ' : ''}${n % 2 ? 14 : 13}px serif`;
    c.textAlign = 'center';
    const title = spineSubjects[n % spineSubjects.length];
    Array.from(letters.segment(title), (part) => part.segment).forEach(
      (ch, i) => c.fillText(ch, x + 32, y + 32 + i * 16),
    );
    c.font = '9px monospace';
    c.fillText(String(n + 1).padStart(3, '0'), x + 32, y + 118);
    if (n % 3 === 0) {
      c.fillRect(x + 7, y + 7, 50, 2);
      c.fillRect(x + 7, y + 123, 50, 2);
    } else if (n % 3 === 1) {
      c.fillRect(x + 5, y + 8, 2, 112);
    }
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  textures.push(tex);
  const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.83 });
  materials.push(m);
  const atlas: SpineAtlas = {
    material: m,
    geometry(w: number, h: number, index: number) {
      const g = new T.PlaneGeometry(w, h),
        uv = g.attributes.uv,
        n = index % 512,
        col = n % cols,
        row = Math.floor(n / cols);
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          (col + 0.02 + uv.getX(i) * 0.96) / cols,
          1 - (row + 0.02 + (1 - uv.getY(i)) * 0.96) / rows,
        );
      return g;
    },
  };
  atlases.set(textures, atlas);
  return atlas;
}
