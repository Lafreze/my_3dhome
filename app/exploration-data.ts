import type { RoomId } from './house-data';

/** One tactile discovery per room. This catalogue also supplies keyboard navigation. */
export const curiosities = {
  studyOrrery: {
    name: '黄铜星轨仪',
    kind: '01 · ORBITS',
    action: '转动星轨',
    room: 'study',
    collection: 'wander.orbits',
    title: '掌心里的星系',
    mark: '星',
    hint: '书柜上，几颗小行星围着黄铜太阳。',
    story: '齿轮慢慢停下。原来一整片星空，也能收进小小的书柜。',
    duration: 7,
    next: 'livingMetronome',
  },
  livingMetronome: {
    name: '胡桃木节拍器',
    kind: '02 · TEMPO',
    action: '拨动摆杆',
    room: 'living',
    collection: 'wander.tempo',
    title: '房间的心跳',
    mark: '拍',
    hint: '茶几靠书的一角，有一根等着摇摆的指针。',
    story: '摆杆一来一回。听歌之前，先给这个下午一个慢拍子。',
    duration: 6,
    next: 'bedroomMusicBox',
  },
  bedroomMusicBox: {
    name: '月亮音乐盒',
    kind: '03 · LULLABY',
    action: '打开 / 合上音乐盒',
    room: 'bedroom',
    collection: 'wander.lullaby',
    title: '装着月亮的盒子',
    mark: '梦',
    hint: '床头的小木盒，锁扣上刻着一弯月亮。',
    story: '盒盖里是一片星夜，小小的月亮绕着自己转了一圈。',
    duration: 7,
    next: 'galleryFlipbook',
  },
  galleryFlipbook: {
    name: '纸上小动画',
    kind: '04 · FRAME BY FRAME',
    action: '转动翻页轮',
    room: 'gallery',
    collection: 'wander.frames',
    title: '纸上的日出',
    mark: '映',
    hint: '展厅西墙的小木架上，有一叠可以转动的风景。',
    story: '一张张静止的画，连起来就成了日出。留白也开始流动。',
    duration: 5,
    next: 'cafeGrinder',
  },
  cafeGrinder: {
    name: '手摇磨豆机',
    kind: '05 · SLOW COFFEE',
    action: '摇一轮咖啡豆',
    room: 'cafe',
    collection: 'wander.grind',
    title: '一圈一圈的香气',
    mark: '豆',
    hint: '咖啡台上，木抽屉等着接住新磨的咖啡粉。',
    story: '摇柄转过几圈，细粉落进小抽屉。好味道也需要一点耐心。',
    duration: 6,
    next: 'corridorChime',
  },
  corridorChime: {
    name: '连廊黄铜风铃',
    kind: '06 · A PASSING BREEZE',
    action: '轻碰风铃',
    room: 'corridor',
    collection: 'wander.chime',
    title: '路过的一阵风',
    mark: '铃',
    hint: '连廊北端，一张纸签垂在长短不同的铃管下。',
    story: '纸签晃了晃：走慢一点，每扇门后都藏着一个下午。',
    duration: 7,
    next: 'libraryHourglass',
  },
  libraryHourglass: {
    name: '阅读沙漏',
    kind: '07 · A LITTLE TIME',
    action: '翻转沙漏',
    room: 'library',
    collection: 'wander.sand',
    title: '借来的一点时间',
    mark: '砂',
    hint: '阅读桌角，两片玻璃之间有一条很细的金线。',
    story: '最后一粒沙落下。时间没有催你，只是陪你读了几行。',
    duration: 8,
    next: 'gamingTop',
  },
  gamingTop: {
    name: '彩木陀螺',
    kind: '08 · ONE MORE SPIN',
    action: '转一下陀螺',
    room: 'gaming',
    collection: 'wander.spin',
    title: '不用屏幕的小游戏',
    mark: '旋',
    hint: '游戏收藏架上，一只彩色陀螺躺在浅木盘里。',
    story: '彩色条纹合成一个圆，又慢慢分开。再玩一次也没有关系。',
    duration: 7,
    next: 'barCoasters',
  },
  barCoasters: {
    name: '酒吧杯垫故事',
    kind: '09 · AFTER HOURS',
    action: '翻开下一张杯垫',
    room: 'bar',
    collection: 'wander.coasters',
    title: '杯底的一句话',
    mark: '笺',
    hint: '吧台靠外的一角，杯垫背面写着店主的小心思。',
    story: '杯垫背面写着：今天也辛苦了。给好好生活的人留一个位置。',
    duration: 3,
    next: 'gardenPinwheel',
  },
  gardenPinwheel: {
    name: '花园纸风车',
    kind: '10 · FOLLOW THE WIND',
    action: '给风车一阵风',
    room: 'garden',
    collection: 'wander.breeze',
    title: '把风留在花园',
    mark: '风',
    hint: '园艺工作台的幼苗旁，一只折纸风车等着微风。',
    story: '风车转起来，叶子轻轻回应。绕过十个角落，又想从头走一次。',
    duration: 6,
    next: 'studyOrrery',
  },
} as const satisfies Record<
  string,
  {
    name: string;
    kind: string;
    action: string;
    room: RoomId;
    collection: string;
    title: string;
    mark: string;
    hint: string;
    story: string;
    duration: number;
    next: string;
  }
>;
export type CuriosityId = keyof typeof curiosities;
export const curiosityIds = Object.keys(curiosities) as CuriosityId[];
export const isCuriosity = (id: string): id is CuriosityId =>
  Object.hasOwn(curiosities, id);
export const curiosityCards = Object.fromEntries(
  curiosityIds.map((id) => {
    const { collection, title, mark, hint } = curiosities[id];
    return [collection, { title, mark, hint }];
  }),
) as {
  [K in (typeof curiosities)[CuriosityId]['collection']]: {
    title: string;
    mark: string;
    hint: string;
  };
};

export function explorationProgress(cards: Partial<Record<string, unknown>>) {
  return {
    found: curiosityIds.filter((id) =>
      Boolean(cards[curiosities[id].collection]),
    ).length,
    total: curiosityIds.length,
    next: curiosityIds.find((id) => !cards[curiosities[id].collection]) ?? null,
  };
}
