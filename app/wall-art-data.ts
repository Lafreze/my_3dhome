export const wallArt = [
  {
    id: 'studyArt1',
    room: '书房',
    name: '书房 · 画作一',
    aspect: 0.685 / 0.94,
  },
  {
    id: 'studyArt2',
    room: '书房',
    name: '书房 · 画作二',
    aspect: 0.685 / 0.94,
  },
  {
    id: 'studyArt3',
    room: '书房',
    name: '书房 · 画作三',
    aspect: 0.685 / 0.94,
  },
  { id: 'livingArt1', room: '客厅', name: '客厅 · 林间', aspect: 1.02 / 1.4 },
  { id: 'livingArt2', room: '客厅', name: '客厅 · 暖日', aspect: 1.02 / 1.4 },
  {
    id: 'galleryArt1',
    room: '展示区',
    name: '展厅 · 作品一',
    aspect: 0.96 / 1.39,
  },
  {
    id: 'galleryArt2',
    room: '展示区',
    name: '展厅 · 作品二',
    aspect: 0.96 / 1.39,
  },
  {
    id: 'galleryArt3',
    room: '展示区',
    name: '展厅 · 作品三',
    aspect: 0.96 / 1.39,
  },
] as const;
export type WallArtId = (typeof wallArt)[number]['id'];
