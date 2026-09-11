export const barDrinks = {
  citrus: {
    name: '暮色橙香',
    detail: '威士忌 · 橙香 · 苏打',
    color: '#d29138',
  },
  mint: { name: '薄荷庭院', detail: '朗姆 · 青柠 · 薄荷', color: '#b3c774' },
  berry: { name: '莓果晚风', detail: '无酒精 · 莓果 · 苏打', color: '#b3656b' },
} as const;
export type BarDrink = keyof typeof barDrinks;
export const barRecords = [
  {
    name: '琥珀爵士',
    detail: '柔和电钢琴与低音',
    color: '#c89851',
    bpm: 78,
    notes: [60, 64, 67, 71, 69, 67, 64, 62],
  },
  {
    name: '雨夜慢拍',
    detail: '低速节拍与钟琴',
    color: '#789285',
    bpm: 66,
    notes: [57, 60, 64, 67, 64, 60, 59, 55],
  },
  {
    name: '晚风摇摆',
    detail: '轻快拨弦与低音',
    color: '#aa6956',
    bpm: 104,
    notes: [62, 66, 69, 71, 69, 66, 64, 62],
  },
] as const;
export type MixPhase = 'idle' | 'ice' | 'pour' | 'shake' | 'garnish' | 'ready';
export const mixLabels: Record<MixPhase, string> = {
  idle: '选一杯喜欢的味道',
  ice: '放入冰块',
  pour: '量取与倒入',
  shake: '摇和调制',
  garnish: '添上装饰',
  ready: '这一杯，慢慢喝',
};
export type BarSnapshot = {
  drink: BarDrink;
  phase: MixPhase;
  age: number;
  fridgeOpen: boolean;
  record: number | null;
};
export function createBarState() {
  const state: BarSnapshot = {
    drink: 'citrus',
    phase: 'idle',
    age: 0,
    fridgeOpen: false,
    record: null,
  };
  return {
    snapshot: (): BarSnapshot => ({ ...state }),
    prepare(drink: BarDrink) {
      if (!(drink in barDrinks) || !['idle', 'ready'].includes(state.phase))
        return false;
      state.drink = drink;
      state.age = 0;
      state.phase = 'ice';
      return true;
    },
    clear() {
      state.phase = 'idle';
      state.age = 0;
    },
    fridge() {
      state.fridgeOpen = !state.fridgeOpen;
    },
    record(index: number | null) {
      state.record =
        index !== null &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < barRecords.length
          ? index
          : null;
    },
    update(dt: number) {
      if (state.phase === 'idle' || state.phase === 'ready') return;
      state.age += Math.max(0, Math.min(dt, 0.1));
      state.phase =
        state.age < 1.3
          ? 'ice'
          : state.age < 3
            ? 'pour'
            : state.age < 5.5
              ? 'shake'
              : state.age < 7
                ? 'garnish'
                : 'ready';
    },
  };
}
export const dartSectors = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];
export type DartHit = { x: number; y: number; score: number; label: string };
export function scoreDart(x: number, y: number): DartHit {
  const r = Math.hypot(x, y);
  if (!Number.isFinite(r) || r > 1)
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      score: 0,
      label: '脱靶',
    };
  if (r <= 0.045) return { x, y, score: 50, label: '红心 · 50' };
  if (r <= 0.105) return { x, y, score: 25, label: '外靶心 · 25' };
  const a = (Math.atan2(x, -y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
  const sector = dartSectors[Math.floor(a / (Math.PI / 10))];
  const multiplier = r >= 0.92 ? 2 : r >= 0.55 && r <= 0.61 ? 3 : 1;
  return {
    x,
    y,
    score: sector * multiplier,
    label: `${multiplier === 3 ? '三倍' : multiplier === 2 ? '双倍' : '单倍'} ${sector} · ${sector * multiplier}`,
  };
}
export function addDart(hits: DartHit[], x: number, y: number) {
  return hits.length >= 9 ? hits : [...hits, scoreDart(x, y)];
}
export const dartTotal = (hits: DartHit[]) =>
  hits.reduce((sum, h) => sum + h.score, 0);
export function readDartBest() {
  try {
    const n = Number(localStorage.getItem('satori-bar-darts-best'));
    return Number.isInteger(n) && n >= 0 && n <= 540 ? n : 0;
  } catch {
    return 0;
  }
}
export function paintDartboard(c: CanvasRenderingContext2D, size: number) {
  c.clearRect(0, 0, size, size);
  c.save();
  c.translate(size / 2, size / 2);
  const r = size / 2.42;
  c.fillStyle = '#202b24';
  c.beginPath();
  c.arc(0, 0, r * 1.2, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 - Math.PI / 20 + (i * Math.PI) / 10,
      b = a + Math.PI / 10;
    for (const [inner, outer, color] of [
      [0.105, 0.55, i % 2 ? '#e7dcc1' : '#29312a'],
      [0.55, 0.61, i % 2 ? '#67836c' : '#aa5747'],
      [0.61, 0.92, i % 2 ? '#e7dcc1' : '#29312a'],
      [0.92, 1, i % 2 ? '#67836c' : '#aa5747'],
    ] as const) {
      c.beginPath();
      c.arc(0, 0, r * outer, a, b);
      c.arc(0, 0, r * inner, b, a, true);
      c.closePath();
      c.fillStyle = color;
      c.fill();
      c.strokeStyle = '#b8b09b';
      c.lineWidth = size / 900;
      c.stroke();
    }
    c.save();
    const t = -Math.PI / 2 + (i * Math.PI) / 10;
    c.translate(Math.cos(t) * r * 1.105, Math.sin(t) * r * 1.105);
    c.fillStyle = '#f3ead5';
    c.font = `500 ${size * 0.039}px Georgia,serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(dartSectors[i]), 0, 0);
    c.restore();
  }
  for (const [radius, color] of [
    [0.105, '#67836c'],
    [0.045, '#aa5747'],
  ] as const) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(0, 0, r * radius, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
