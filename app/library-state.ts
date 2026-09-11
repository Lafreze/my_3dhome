import { libraryLadderStops } from './library-layout.ts';
export const libraryBooks = {
  forest: {
    title: '林间手记',
    subtitle: '把季节夹进书页',
    color: '#56664a',
    pages: [
      {
        title: '窗前的一片叶子',
        text: '清晨，窗框把第一束光分成几格，正好落在翻开的书上。昨天夹进来的叶子已经干了，边缘微微卷起，像一只安静的小舟。\n\n我原本想读完这一章，却先看了很久的树影。书页并不催促，季节也不催促。于是把书签向后挪了一页，给今天留下一小块空白。',
      },
      {
        title: '雨落在书脊之间',
        text: '雨来的时候，屋里会先安静一层。窗外的枝叶渐渐变深，书脊上的金线却在灯下亮起来。杯子靠近手边，雨声隔着玻璃，恰好够听。\n\n一本书有时像一条林间小径，不急着抵达哪里。读累了就停下，记住这一句，再看看窗外。',
      },
      {
        title: '午后的标本',
        text: '那朵小花夹在两张纸之间，颜色比记忆里浅了一些。我在旁边写下日期，又画了一片并不像真的叶子。\n\n原来收藏不一定要保存原样，也可以只是记住：那天下午有风，路边开着花，而我正好经过。',
      },
      {
        title: '把灯留给下一页',
        text: '天色慢慢暗下来，远处的树先退成轮廓，随后才是窗上的倒影。我把钢笔盖好，把翻到一半的书留在桌面。\n\n明天再从这里开始。或许会遇见新的句子，也或许只是重新喜欢上昨天的那一句。',
      },
    ],
  },
  journey: {
    title: '远方来信',
    subtitle: '一封不赶时间的信',
    color: '#a07b4f',
    pages: [
      {
        title: '没有时刻表的车站',
        text: '亲爱的朋友：今天经过一个很小的车站。长椅朝着山，售票窗边放着一盆薄荷。列车还没来，站台上的人却似乎都不着急。\n\n我坐了一会儿，把原本打算发出的消息写进信里。远方未必在地图的尽头，有时只是换一个地方，慢慢坐下。',
      },
      {
        title: '旅馆里的旧地图',
        text: '旅馆主人把一张旧地图铺在桌上，纸角已经柔软。他指着一条弯曲的小路，说沿着走，就会遇到一棵很好认的树。\n\n第二天，我没有找到那棵树，却找到一间开着窗的面包房。也许有些指路，只是为了让人愿意出门。',
      },
      {
        title: '海边的明信片',
        text: '在海边买了一张没有印字的明信片。我画了一条歪歪的水平线，又在下面写：今天的风很大，帽子差一点先替我去旅行。\n\n不知道这句话抵达你手上时，我们各自会在什么地方。愿你拆信的时候，窗边也有一点光。',
      },
      {
        title: '归来的行李',
        text: '行李里多了一本小册子、两张车票和一颗没有名字的石头。它们都不贵重，却让回家的路显得具体起来。\n\n等你来的时候，我会把地球仪转到窗边。我们指着那些还没有去过的地方，先喝完这一杯茶。',
      },
    ],
  },
  house: {
    title: '小屋年鉴',
    subtitle: '关于日常的轻声记录',
    color: '#805346',
    pages: [
      {
        title: '新房间的第一天',
        text: '新书架比想象中装得下更多故事。靠窗的两格暂时留空，准备放一些后来才会喜欢上的东西。\n\n椅子搬进来的那一刻，这个房间才像真正有人住。现在，只差一本翻开的书，和一位愿意坐一会儿的朋友。',
      },
      {
        title: '桌上的小秩序',
        text: '钢笔放在右手边，放大镜靠着书角。纸张有一点偏，但不用急着摆正；一张正在使用的桌子，总要给偶然留出位置。\n\n整理到最后，我只收走了空杯子，把那句还没写完的话留了下来。',
      },
      {
        title: '书车经过的地方',
        text: '小书车的轮子经过地毯边缘时，会轻轻顿一下。上层是今天想读的，下层是舍不得放回去的，中间还夹着一本借来的画册。\n\n所谓收藏，大概就是替每一次心动找一个位置，同时也记得留出走路的地方。',
      },
      {
        title: '下一位读者',
        text: '如果你正坐在这里，可以随意挑一本书。读到喜欢的地方，不妨停一停，听听屋外的风。\n\n离开时把书放回原处就好。下一位读者到来之前，这盏灯会继续照着空出来的座位。',
      },
    ],
  },
} as const;
export type LibraryBookId = keyof typeof libraryBooks;
export type LibrarySnapshot = {
  book: LibraryBookId;
  page: number;
  previousPage: number;
  phase: 'shelved' | 'taking' | 'reading' | 'returning';
  age: number;
  turn: number;
  direction: 1 | -1;
  ladderStop: number;
  ladderPosition: number;
  globeSpinning: boolean;
};
export type LibraryCommand =
  | { type: 'borrow'; book: LibraryBookId; page?: number }
  | { type: 'return' }
  | { type: 'page'; direction: 1 | -1 }
  | { type: 'ladder'; stop: number }
  | { type: 'globe' };
export function createLibraryState() {
  const state: LibrarySnapshot = {
    book: 'forest',
    page: 0,
    previousPage: 0,
    phase: 'shelved',
    age: 0,
    turn: 1,
    direction: 1,
    ladderStop: 1,
    ladderPosition: libraryLadderStops[1],
    globeSpinning: true,
  };
  const stops = libraryLadderStops;
  return {
    snapshot: (): LibrarySnapshot => ({ ...state }),
    command(command: LibraryCommand) {
      switch (command.type) {
        case 'borrow':
          if (!Object.hasOwn(libraryBooks, command.book)) return false;
          state.book = command.book;
          state.page = Number.isInteger(command.page)
            ? Math.max(
                0,
                Math.min(
                  command.page!,
                  libraryBooks[command.book].pages.length - 1,
                ),
              )
            : 0;
          state.previousPage = state.page;
          state.phase = 'taking';
          state.age = 0;
          state.turn = 1;
          return true;
        case 'return':
          if (state.phase === 'shelved') return false;
          state.phase = 'returning';
          state.age = 0;
          state.turn = 1;
          return true;
        case 'page': {
          if (
            state.phase !== 'reading' ||
            state.turn < 1 ||
            ![-1, 1].includes(command.direction)
          )
            return false;
          const next = state.page + command.direction;
          if (next < 0 || next >= libraryBooks[state.book].pages.length)
            return false;
          state.previousPage = state.page;
          state.page = next;
          state.turn = 0;
          state.direction = command.direction;
          return true;
        }
        case 'ladder':
          if (
            !Number.isInteger(command.stop) ||
            command.stop < 0 ||
            command.stop >= stops.length
          )
            return false;
          state.ladderStop = command.stop;
          return true;
        case 'globe':
          state.globeSpinning = !state.globeSpinning;
          return true;
      }
    },
    update(dt: number, reduced = false) {
      const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      state.age += d;
      if (state.phase === 'taking' && state.age >= 0.7) state.phase = 'reading';
      if (state.phase === 'returning' && state.age >= 0.7)
        state.phase = 'shelved';
      state.turn = Math.min(1, state.turn + d / 0.75);
      const target = stops[state.ladderStop],
        distance = target - state.ladderPosition;
      state.ladderPosition = reduced
        ? target
        : state.ladderPosition +
          Math.sign(distance) * Math.min(Math.abs(distance), d * 0.8);
    },
  };
}
export const libraryBookmarkKey = 'satori-library-bookmarks';
export function readLibraryBookmarks(): Record<LibraryBookId, number> {
  const result = { forest: 0, journey: 0, house: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem(libraryBookmarkKey) || '{}');
    for (const id of Object.keys(result) as LibraryBookId[])
      if (
        Number.isInteger(stored?.[id]) &&
        stored[id] >= 0 &&
        stored[id] < libraryBooks[id].pages.length
      )
        result[id] = stored[id];
  } catch {}
  return result;
}
