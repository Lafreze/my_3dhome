import type { Environment, TimeOfDay, Weather } from './environment-data';
import type { RoomId } from './house-data';
export const weatherDialogue: Record<Weather, string[]> = {
  clear: [
    '今天的光很好。坐到窗边，让杯子也晒一小会儿太阳吧。',
    '晴天适合给植物转个方向。它们总是偷偷朝着光长。',
    '如果暂时没有安排，就把这段晴天留给自己。',
  ],
  cloudy: [
    '阴天的光很柔和，我最喜欢在这样的光里翻画册。',
    '云把太阳收起来了，小屋里的灯就显得格外暖。',
    '这样的天气，慢一点也很合适。你想听张唱片吗？',
  ],
  rain: [
    '雨落在窗沿上的声音，刚好能陪我们喝完一杯咖啡。',
    '进来歇歇吧。雨天不必急着赶路，窗边的位置给你留着。',
    '今天想挑一本读过的书。熟悉的故事，和雨声很配。',
    '植物大概很喜欢这场雨。等雨小了，我们再去花园看看。',
  ],
  snow: [
    '外面下雪了。把手捂暖，再慢慢捧起杯子。',
    '下雪时整个世界都轻了一点。今天的小屋也轻声说话。',
    '雪落得这么安静，我想把这片窗景画下来。',
  ],
  fog: [
    '雾把远处藏起来了，眼前的一盏灯就足够。',
    '今天适合在屋里找一点小发现。也许是一张夹在书里的花。',
    '窗外像还没画完的水彩，我们先在这里坐一会儿。',
  ],
  storm: [
    '雷声有点大，来里面坐。我们开盏灯，等这阵雨过去。',
    '这种时候，我会把音乐放轻一点，让屋子里安稳一些。',
    '先别急着出门。一杯热饮的时间，天气也许就缓下来了。',
  ],
};
export const timeDialogue: Record<TimeOfDay, string[]> = {
  morning: [
    '早呀。第一杯咖啡刚好，新的一天可以慢慢开始。',
    '清晨的小屋最安静，连翻书声都听得很清楚。',
    '今天想先做一件小事：浇花、整理桌面，或者好好吃早餐。',
    '窗边还空着。趁光刚刚照进来，坐一会儿吧。',
  ],
  afternoon: [
    '午后的时间有点松软。要不要读几页书，再打个盹？',
    '忙到这里已经很好了。给自己留一段不赶时间的下午。',
    '我正想换张唱片。你来了，刚好一起听。',
    '午后适合找点小乐趣。游戏房和花园都等着你。',
  ],
  sunset: [
    '夕阳走得很慢，我们也不用急着结束今天。',
    '我喜欢这个时候，灯刚亮起来，窗外还有一点金色。',
    '今天有什么想留下的小事吗？可以写在小屋的手记里。',
    '日落前再看一眼花园吧。叶子的边缘会变成金色。',
  ],
  night: [
    '晚上好。小屋还亮着灯，想坐多久都可以。',
    '这个时间，我会把手边的事情放下，听完一面唱片。',
    '如果困了，卧室有干净的枕头。今天就到这里也很好。',
    '夜里不用有特别的安排。我们安静待一会儿就好。',
  ],
};
export const roomDialogue: Record<RoomId, string[]> = {
  study: [
    '这张桌子见过很多没完成的草稿。慢慢做，也是一种进展。',
    '书架上的手记可以翻翻。有些想法，写下来就不容易丢了。',
  ],
  living: [
    '沙发边的位置最舒服。想看点什么，就拿起遥控器吧。',
    '有时候我什么也不看，只让唱片陪着屋子。',
  ],
  bedroom: [
    '床头留了一杯水。想休息的话，就放心躺一会儿。',
    '这里不安排工作。把肩膀放松，睡一个小觉也可以。',
  ],
  gallery: [
    '每件作品都有一些反复修改的痕迹。靠近看，会发现更多。',
    '你看到的细节，可能正是我制作时最舍不得放下的部分。',
  ],
  cafe: [
    '欢迎光临。今天想喝熟悉的那杯，还是试试新口味？',
    '杯子热起来的时候，香气也会慢慢展开。不急，等一下。',
    '我喜欢听大家落座的声音，咖啡厅就这样热闹起来了。',
  ],
  corridor: [
    '每次路过这些画，都能注意到一个以前没发现的颜色。',
    '走廊把大家的小日常连在一起。你接下来想去哪一间？',
  ],
  gaming: [
    '来一局吧。输赢没关系，玩得开心就值得。',
    '小时候总想再玩最后一局。现在也还是这样。',
  ],
  library: [
    '随便挑一本。读到喜欢的地方，记得夹好书签。',
    '这里有旅行，也有食谱。书架像一扇扇很小的门。',
  ],
  garden: [
    '今天看看叶子就好。植物不是每天都有大变化，但每天都在长。',
    '花园里有柠檬水。看完花，坐下来一起喝一杯吧。',
    '压花册里存着一些小季节。翻的时候轻一点。',
  ],
  bar: [
    '今晚想喝清爽的，还是带一点果香的？也有不含酒精的选择。',
    '唱片转起来，小酒馆的一天才慢慢落定。',
  ],
};
const familiarDialogue = [
  '又见面了。你已经很熟悉这里了，就像回自己家一样。',
  '今天也给你留了一个舒服的位置。想聊天或者安静坐着，都好。',
  '上次没来得及看的角落，今天可以慢慢逛。',
  '你常来，小屋就多了一点熟悉的声音。',
];
const everydayDialogue = [
  '小黑猫喜欢自己选位置。它愿意靠近的时候，记得轻轻打招呼。',
  '我想让这里慢慢积攒生活的痕迹，一本翻开的书，一杯没喝完的茶。',
  '不必每次来都做点什么。能在这里放松，就是很好的事。',
  '有新的想法就记在手记里吧。小小的灵感也值得被留下。',
];
export class ResidentDialogue {
  private recent: string[] = [];
  private turn = 0;
  private familiar: boolean;
  constructor(familiar?: boolean) {
    this.familiar = familiar ?? false;
    if (familiar === undefined) {
      try {
        this.familiar = localStorage.getItem('satori-resident-met-v1') === '1';
      } catch {
        /* Optional memory. */
      }
    }
  }
  next(environment: Environment, room: RoomId, random = Math.random) {
    const pools = [
      weatherDialogue[environment.weather],
      timeDialogue[environment.time],
      roomDialogue[room],
      this.familiar || this.turn >= 4 ? familiarDialogue : everydayDialogue,
    ];
    const pool = pools[this.turn++ % pools.length];
    const choices = pool.filter((text) => !this.recent.includes(text));
    const available = choices.length ? choices : pool;
    const text =
      available[
        Math.min(
          available.length - 1,
          Math.floor(Math.max(0, random()) * available.length),
        )
      ];
    try {
      localStorage.setItem('satori-resident-met-v1', '1');
    } catch {
      /* Optional memory. */
    }
    this.recent.push(text);
    if (this.recent.length > 8) this.recent.shift();
    return text;
  }
}
