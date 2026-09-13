import type { GameStatus } from './game-engine';

export type CabinetId =
  | 'pinball'
  | 'racing'
  | 'shooter'
  | 'platform'
  | 'sokoban'
  | 'reversi'
  | 'rhythm';
export type Control =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'action'
  | 'extra'
  | 'lane0'
  | 'lane1'
  | 'lane2'
  | 'lane3';
export type PinballView = {
  x: number;
  y: number;
  left: boolean;
  right: boolean;
  score: number;
};
export type Input = {
  held: Set<Control>;
  pressed: Set<Control>;
  point?: [number, number];
};
type Base = {
  id: CabinetId;
  status: GameStatus;
  score: number;
  time: number;
  message: string;
};
export type Pinball = Base & {
  id: 'pinball';
  x: number;
  y: number;
  vx: number;
  vy: number;
  balls: number;
  launched: boolean;
  launching: boolean;
  glow: number[];
  hits: number;
};
export type Racing = Base & {
  id: 'racing';
  x: number;
  y: number;
  angle: number;
  speed: number;
  fuel: number;
  checkpoint: number;
  lap: number;
  offroad: boolean;
  trail: [number, number][];
};
type Shot = { x: number; y: number; vx: number; vy: number; enemy?: boolean };
export type Shooter = Base & {
  id: 'shooter';
  x: number;
  y: number;
  hp: number;
  shield: number;
  cooldown: number;
  wave: number;
  waveTime: number;
  enemies: { x: number; y: number; hp: number; phase: number; boss: boolean }[];
  shots: Shot[];
  bombs: number;
  invulnerable: number;
  kills: number;
};
type PlatformRect = { x: number; y: number; w: number; h: number };
export type Platform = Base & {
  id: 'platform';
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  coyote: number;
  jumpBuffer: number;
  lives: number;
  checkpoint: number;
  coins: { x: number; y: number; taken: boolean }[];
  platforms: PlatformRect[];
  enemies: { x: number; start: number; end: number; dead: boolean }[];
  invulnerable: number;
  camera: number;
};
export type Sokoban = Base & {
  id: 'sokoban';
  level: number;
  width: number;
  height: number;
  walls: number[];
  goals: number[];
  boxes: number[];
  player: number;
  moves: number;
  history: { player: number; boxes: number[]; moves: number }[];
  solved: boolean;
};
export type Reversi = Base & {
  id: 'reversi';
  cells: number[];
  turn: 1 | 2;
  cursor: number;
  aiDelay: number;
  last: number;
  passes: number;
};
export type Rhythm = Base & {
  id: 'rhythm';
  notes: { lane: number; at: number; judged: boolean; grade: number }[];
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  judgement: string;
  flash: number;
  lanes: number[];
  health: number;
  beat: number;
};
export type CabinetGame =
  | Pinball
  | Racing
  | Shooter
  | Platform
  | Sokoban
  | Reversi
  | Rhythm;
export const cabinetIds: CabinetId[] = [
  'pinball',
  'racing',
  'shooter',
  'platform',
  'sokoban',
  'reversi',
  'rhythm',
];
export const cabinetInfo: Record<
  CabinetId,
  {
    title: string;
    english: string;
    genre: string;
    goal: string;
    controls: string;
    color: string;
  }
> = {
  pinball: {
    title: '星轨弹珠',
    english: 'ORBIT / PINBALL',
    genre: '物理弹珠',
    goal: '三颗钢珠 · 撞击星环，挑战 5,000 分',
    controls: '← → 挡板 · 空格发球',
    color: '#345d66',
  },
  racing: {
    title: '海岸拉力',
    english: 'COAST / RALLY',
    genre: '俯视赛车',
    goal: '90 秒内跑完三圈，依次经过检查点',
    controls: '↑ 油门 · ↓ 刹车 · ← → 转向 · 空格加速',
    color: '#4d7967',
  },
  shooter: {
    title: '星际信使',
    english: 'NOVA / COURIER',
    genre: '飞行射击',
    goal: '突破四波敌机，击败旗舰',
    controls: '方向键移动 · 空格射击 · X 护盾脉冲',
    color: '#454d7a',
  },
  platform: {
    title: '苔原快递',
    english: 'MOSS / EXPRESS',
    genre: '平台冒险',
    goal: '收集至少六颗星，抵达山顶邮局',
    controls: '← → 移动 · ↑ / 空格跳跃 · 踩踏敌人',
    color: '#6b8062',
  },
  sokoban: {
    title: '仓库小猫',
    english: 'PAWS / WAREHOUSE',
    genre: '推箱解谜',
    goal: '五间仓库，把每个木箱推到标记上',
    controls: '方向键推动 · X 撤销 · 支持点按相邻格',
    color: '#aa7959',
  },
  reversi: {
    title: '月下黑白棋',
    english: 'MOON / REVERSI',
    genre: '策略对弈',
    goal: '执黑对弈，终局时占据更多棋格',
    controls: '点按落子 · 方向键选格 · 空格确认',
    color: '#485f72',
  },
  rhythm: {
    title: '夜行节拍',
    english: 'NIGHT / BEATS',
    genre: '四轨音游',
    goal: '跟随节拍完成整首曲目，命中率达到 65%',
    controls: 'D F J K 四条轨道 · 也可点按下方琴键',
    color: '#866285',
  },
};
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const has = (i: Input, c: Control) => i.held.has(c);
const tap = (i: Input, c: Control) => i.pressed.has(c);
export const emptyInput = (): Input => ({
  held: new Set(),
  pressed: new Set(),
});
export const warehouseLevels = [
  ['#######', '#     #', '# .$. #', '# $@$ #', '#  .  #', '#     #', '#######'],
  ['########', '#  #   #', '#  $ . #', '# @$ . #', '#  #   #', '########'],
  [
    '########',
    '#      #',
    '# .##  #',
    '# .$ $ #',
    '#  @   #',
    '#      #',
    '########',
  ],
  [
    '########',
    '#   .  #',
    '# # $  #',
    '# . $@ #',
    '# # $  #',
    '#   .  #',
    '########',
  ],
  [
    '#########',
    '#   #   #',
    '# .   . #',
    '# $$# $ #',
    '#   @   #',
    '# .     #',
    '#########',
  ],
];
export function loadWarehouse(g: Sokoban, level: number) {
  const rows = warehouseLevels[level];
  g.level = level;
  g.width = rows[0].length;
  g.height = rows.length;
  g.walls = [];
  g.goals = [];
  g.boxes = [];
  g.history = [];
  g.moves = 0;
  g.solved = false;
  rows.forEach((row, y) =>
    row.split('').forEach((c, x) => {
      const p = y * g.width + x;
      if (c === '#') g.walls.push(p);
      if (c === '.') g.goals.push(p);
      if (c === '$') g.boxes.push(p);
      if (c === '@') g.player = p;
    }),
  );
  g.message = `仓库 ${level + 1} / ${warehouseLevels.length}`;
}
export function createCabinet(id: CabinetId): CabinetGame {
  const base = {
    id,
    status: 'ready' as GameStatus,
    score: 0,
    time: 0,
    message: '',
  };
  switch (id) {
    case 'pinball':
      return {
        ...base,
        id,
        x: 487,
        y: 402,
        vx: 0,
        vy: 0,
        balls: 3,
        launched: false,
        launching: false,
        glow: [0, 0, 0, 0],
        hits: 0,
      };
    case 'racing':
      return {
        ...base,
        id,
        x: 360,
        y: 385,
        angle: Math.PI,
        speed: 0,
        fuel: 100,
        checkpoint: 0,
        lap: 0,
        offroad: false,
        trail: [],
      };
    case 'shooter':
      return {
        ...base,
        id,
        x: 360,
        y: 392,
        hp: 5,
        shield: 0,
        cooldown: 0,
        wave: 0,
        waveTime: 0,
        enemies: [],
        shots: [],
        bombs: 2,
        invulnerable: 0,
        kills: 0,
      };
    case 'platform':
      return {
        ...base,
        id,
        x: 64,
        y: 382,
        vx: 0,
        vy: 0,
        grounded: true,
        coyote: 0,
        jumpBuffer: 0,
        lives: 3,
        checkpoint: 64,
        invulnerable: 0,
        camera: 0,
        platforms: [
          { x: 0, y: 400, w: 360, h: 80 },
          { x: 440, y: 400, w: 340, h: 80 },
          { x: 875, y: 400, w: 360, h: 80 },
          { x: 1330, y: 400, w: 470, h: 80 },
          { x: 180, y: 302, w: 130, h: 18 },
          { x: 530, y: 293, w: 130, h: 18 },
          { x: 955, y: 295, w: 140, h: 18 },
          { x: 1420, y: 296, w: 110, h: 18 },
          { x: 1580, y: 226, w: 140, h: 18 },
        ],
        coins: [
          140, 260, 490, 610, 740, 925, 1030, 1190, 1390, 1475, 1630, 1740,
        ].map((x, i) => ({
          x,
          y: [355, 259, 355, 249, 355, 355, 251, 355, 355, 252, 182, 355][i],
          taken: false,
        })),
        enemies: [
          { x: 535, start: 480, end: 725, dead: false },
          { x: 1030, start: 905, end: 1185, dead: false },
          { x: 1410, start: 1370, end: 1550, dead: false },
        ],
      };
    case 'sokoban': {
      const g: Sokoban = {
        ...base,
        id,
        level: 0,
        width: 0,
        height: 0,
        walls: [],
        goals: [],
        boxes: [],
        player: 0,
        moves: 0,
        history: [],
        solved: false,
      };
      loadWarehouse(g, 0);
      return g;
    }
    case 'reversi': {
      const cells = Array<number>(64).fill(0);
      cells[27] = cells[36] = 2;
      cells[28] = cells[35] = 1;
      return {
        ...base,
        id,
        cells,
        turn: 1,
        cursor: 19,
        aiDelay: 0,
        last: -1,
        passes: 0,
      };
    }
    case 'rhythm':
      return {
        ...base,
        id,
        notes: Array.from({ length: 80 }, (_, j) => ({
          lane: [0, 1, 2, 3, 1, 2, 0, 3, 2, 1, 3, 0, 2, 0, 1, 3][j % 16],
          at: 2 + j * 0.5 + (j > 31 && j % 8 === 6 ? -0.25 : 0),
          judged: false,
          grade: 0,
        })),
        combo: 0,
        bestCombo: 0,
        hits: 0,
        misses: 0,
        judgement: '',
        flash: 0,
        lanes: [0, 0, 0, 0],
        health: 100,
        beat: -1,
      };
  }
}
export const bumpers = [
  { x: 285, y: 148, r: 25 },
  { x: 435, y: 148, r: 25 },
  { x: 360, y: 226, r: 31 },
  { x: 360, y: 83, r: 18 },
];
export function flipperSegment(
  left: boolean,
  active: boolean,
): [number, number, number, number] {
  return left
    ? [277, 388, 339, active ? 358 : 415]
    : [443, 388, 381, active ? 358 : 415];
}
function pinball(g: Pinball, dt: number, i: Input) {
  g.glow = g.glow.map((v) => Math.max(0, v - dt));
  if (!g.launched) {
    g.message = `空格发球 · 剩余 ${g.balls} 颗`;
    if (tap(i, 'action')) {
      g.launched = true;
      g.x = 483;
      g.y = 390;
      g.vx = 0;
      g.vy = -640;
      g.launching = true;
    }
    return;
  }
  g.message = '';
  // Substeps prevent a fast ball tunnelling through a rail or flipper.
  const steps = Math.ceil(dt / 0.004),
    d = dt / steps;
  for (let step = 0; step < steps; step++) {
    if (g.launching && g.y < 72) {
      g.launching = false;
      g.vx = -260 + Math.sin(g.time * 2.6) * 65;
      g.vy = -80;
    }
    g.vy += 415 * d;
    g.x += g.vx * d;
    g.y += g.vy * d;
    if (g.x < 224) {
      g.x = 224;
      g.vx = Math.abs(g.vx) * 0.9;
    }
    if (g.x > 496) {
      g.x = 496;
      g.vx = -Math.abs(g.vx) * 0.9;
    }
    if (g.y < 47) {
      g.y = 47;
      g.vy = Math.abs(g.vy) * 0.92;
    }
    bumpers.forEach((b, j) => {
      const dx = g.x - b.x,
        dy = g.y - b.y,
        len = Math.hypot(dx, dy);
      if (len < b.r + 7) {
        const nx = dx / (len || 1),
          ny = dy / (len || 1);
        g.x = b.x + nx * (b.r + 7);
        g.y = b.y + ny * (b.r + 7);
        const dot = g.vx * nx + g.vy * ny;
        if (dot < 0) {
          g.vx -= 2 * dot * nx;
          g.vy -= 2 * dot * ny;
          g.vx += nx * 75;
          g.vy += ny * 75;
          g.score += 250;
          g.hits++;
          g.glow[j] = 0.23;
        }
      }
    });
    const rails: [[number, number, number, number], boolean][] = [
      [[224, 300, 277, 388], false],
      [[496, 300, 443, 388], false],
      [flipperSegment(true, has(i, 'left')), has(i, 'left')],
      [flipperSegment(false, has(i, 'right')), has(i, 'right')],
    ];
    for (const [[ax, ay, bx, by], active] of g.launching ? [] : rails) {
      const dx = bx - ax,
        dy = by - ay,
        t = clamp(
          ((g.x - ax) * dx + (g.y - ay) * dy) / (dx * dx + dy * dy),
          0,
          1,
        ),
        px = ax + dx * t,
        py = ay + dy * t,
        len = Math.hypot(g.x - px, g.y - py);
      if (len < 13) {
        const nx = (g.x - px) / (len || 1),
          ny = (g.y - py) / (len || 1),
          dot = g.vx * nx + g.vy * ny;
        g.x = px + nx * 13;
        g.y = py + ny * 13;
        if (dot < 0) {
          g.vx -= 1.75 * dot * nx;
          g.vy -= 1.75 * dot * ny;
          if (active) {
            g.vy = -480;
            g.vx += (360 - g.x) * 2;
            g.score += 10;
          }
        }
      }
    }
    const speed = Math.hypot(g.vx, g.vy);
    if (speed > 760) {
      g.vx *= 760 / speed;
      g.vy *= 760 / speed;
    }
    if (g.y > 465) {
      g.balls--;
      g.launched = false;
      g.x = 487;
      g.y = 402;
      g.vx = g.vy = 0;
      if (!g.balls) g.status = g.score >= 5000 ? 'won' : 'lost';
      break;
    }
  }
  if (g.score >= 5000) g.status = 'won';
}
export const raceGate = (checkpoint: number): [number, number] => {
  const a = Math.PI / 2 + ((checkpoint + 1) * Math.PI) / 2;
  return [360 + 255 * Math.cos(a), 240 + 145 * Math.sin(a)];
};
function racing(g: Racing, dt: number, i: Input) {
  const r = Math.hypot((g.x - 360) / 255, (g.y - 240) / 145);
  g.offroad = Math.abs(r - 1) > 0.23;
  const boost = has(i, 'action') && g.fuel > 0 && has(i, 'up') && !g.offroad;
  const max = g.offroad ? 75 : boost ? 310 : 215;
  g.speed = clamp(
    g.speed + (has(i, 'up') ? 165 : has(i, 'down') ? -300 : -70) * dt,
    0,
    max,
  );
  g.fuel = clamp(g.fuel + (boost ? -32 : 12) * dt, 0, 100);
  g.angle +=
    (Number(has(i, 'right')) - Number(has(i, 'left'))) *
    2.65 *
    dt *
    Math.min(1, g.speed / 80);
  g.x = clamp(g.x + Math.cos(g.angle) * g.speed * dt, 20, 700);
  g.y = clamp(g.y + Math.sin(g.angle) * g.speed * dt, 38, 458);
  g.trail.push([g.x, g.y]);
  if (g.trail.length > 60) g.trail.shift();
  const gate = raceGate(g.checkpoint);
  if (Math.hypot(g.x - gate[0], g.y - gate[1]) < 49) {
    g.checkpoint++;
    g.score += 250;
    if (g.checkpoint === 4) {
      g.checkpoint = 0;
      g.lap++;
      g.score += 1000;
      if (g.lap === 3) {
        g.status = 'won';
        g.score += Math.max(0, Math.floor((90 - g.time) * 50));
      }
    }
  }
  if (g.time >= 90 && g.status === 'playing') g.status = 'lost';
  g.message = g.offroad
    ? '驶回赛道'
    : `第 ${Math.min(3, g.lap + 1)} / 3 圈 · ${Math.max(0, Math.ceil(90 - g.time))} 秒`;
}
function spawnWave(g: Shooter) {
  g.wave++;
  g.waveTime = 0;
  g.enemies =
    g.wave === 4
      ? [{ x: 360, y: 76, hp: 65, phase: 0, boss: true }]
      : Array.from({ length: 5 + g.wave * 2 }, (_, j) => ({
          x: 100 + (j % 7) * 86,
          y: -45 - Math.floor(j / 7) * 58,
          hp: g.wave === 3 ? 3 : 2,
          phase: j * 0.82,
          boss: false,
        }));
}
function shooter(g: Shooter, dt: number, i: Input) {
  if (!g.enemies.length) {
    if (g.wave === 4) {
      g.status = 'won';
      g.score += g.hp * 500;
      return;
    }
    spawnWave(g);
  }
  g.waveTime += dt;
  g.cooldown -= dt;
  g.shield = Math.max(0, g.shield - dt);
  g.invulnerable = Math.max(0, g.invulnerable - dt);
  let dx = Number(has(i, 'right')) - Number(has(i, 'left')),
    dy = Number(has(i, 'down')) - Number(has(i, 'up'));
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  g.x = clamp(g.x + dx * 285 * dt, 24, 696);
  g.y = clamp(g.y + dy * 285 * dt, 235, 443);
  if (has(i, 'action') && g.cooldown <= 0) {
    g.shots.push(
      { x: g.x - 9, y: g.y - 15, vx: 0, vy: -580 },
      { x: g.x + 9, y: g.y - 15, vx: 0, vy: -580 },
    );
    g.cooldown = 0.16;
  }
  if (tap(i, 'extra') && g.bombs > 0) {
    g.bombs--;
    g.shield = 1.4;
    g.shots = g.shots.filter((s) => !s.enemy);
    g.enemies.forEach((e) => (e.hp -= e.boss ? 10 : 3));
  }
  const firing =
    Math.floor(g.waveTime / (g.wave === 4 ? 0.6 : 1.1)) !==
    Math.floor((g.waveTime - dt) / (g.wave === 4 ? 0.6 : 1.1));
  for (const e of g.enemies) {
    e.x += Math.cos(g.time * 1.7 + e.phase) * 38 * dt;
    e.y = Math.min(e.boss ? 80 : 115 + e.phase * 12, e.y + 75 * dt);
    if (firing) {
      const angle = Math.atan2(g.y - e.y, g.x - e.x);
      for (const offset of e.boss ? [-0.35, 0, 0.35] : [0])
        g.shots.push({
          x: e.x,
          y: e.y + 15,
          vx: Math.cos(angle + offset) * 175,
          vy: Math.sin(angle + offset) * 175,
          enemy: true,
        });
    }
  }
  for (const s of g.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.enemy) {
      if (Math.hypot(s.x - g.x, s.y - g.y) < 20) {
        s.y = 600;
        if (!g.shield && !g.invulnerable) {
          g.hp--;
          g.invulnerable = 1.2;
        }
      }
    } else
      for (const e of g.enemies)
        if (
          e.hp > 0 &&
          Math.abs(s.x - e.x) < (e.boss ? 53 : 22) &&
          Math.abs(s.y - e.y) < (e.boss ? 28 : 19)
        ) {
          e.hp--;
          s.y = -999;
          break;
        }
  }
  const dead = g.enemies.filter((e) => e.hp <= 0);
  g.kills += dead.length;
  g.score += dead.reduce((sum, e) => sum + (e.boss ? 3000 : 150), 0);
  g.enemies = g.enemies.filter((e) => e.hp > 0);
  g.shots = g.shots.filter(
    (s) => s.y > -40 && s.y < 510 && s.x > -20 && s.x < 740,
  );
  if (g.hp <= 0) g.status = 'lost';
  g.message = `第 ${g.wave} / 4 波 · 装甲 ${g.hp} · 脉冲 ${g.bombs}`;
}
function platform(g: Platform, dt: number, i: Input) {
  g.invulnerable = Math.max(0, g.invulnerable - dt);
  g.coyote = Math.max(0, g.coyote - dt);
  g.jumpBuffer = Math.max(0, g.jumpBuffer - dt);
  if (tap(i, 'up') || tap(i, 'action')) g.jumpBuffer = 0.14;
  const dir = Number(has(i, 'right')) - Number(has(i, 'left'));
  g.vx += (dir * 225 - g.vx) * Math.min(1, dt * 14);
  if (g.jumpBuffer > 0 && (g.grounded || g.coyote > 0)) {
    g.vy = -520;
    g.grounded = false;
    g.coyote = 0;
    g.jumpBuffer = 0;
  }
  const previous = g.y;
  g.vy = Math.min(650, g.vy + 1080 * dt);
  g.x = clamp(g.x + g.vx * dt, 16, 1784);
  g.y += g.vy * dt;
  g.grounded = false;
  for (const p of g.platforms)
    if (
      g.x + 13 > p.x &&
      g.x - 13 < p.x + p.w &&
      previous + 18 <= p.y + 0.5 &&
      g.y + 18 >= p.y &&
      g.vy >= 0
    ) {
      g.y = p.y - 18;
      g.vy = 0;
      g.grounded = true;
      g.coyote = 0.1;
    }
  for (const c of g.coins)
    if (!c.taken && Math.hypot(c.x - g.x, c.y - g.y) < 29) {
      c.taken = true;
      g.score += 100;
    }
  if (g.grounded && g.x > 890 && g.x < 1230) g.checkpoint = 905;
  const hurt = () => {
    if (g.invulnerable > 0) return;
    g.lives--;
    if (!g.lives) {
      g.status = 'lost';
      return;
    }
    g.x = g.checkpoint;
    g.y = 340;
    g.vx = g.vy = 0;
    g.invulnerable = 1.8;
  };
  if (g.y > 510) {
    g.invulnerable = 0;
    hurt();
  }
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.x =
      e.start +
      (Math.sin(g.time * 1.6 + e.start) + 1) * 0.5 * (e.end - e.start);
    if (Math.abs(g.x - e.x) < 27 && Math.abs(g.y - 383) < 27) {
      if (g.vy > 0 && previous < 359) {
        e.dead = true;
        g.vy = -320;
        g.score += 150;
      } else hurt();
    }
  }
  const collected = g.coins.filter((c) => c.taken).length;
  if (g.x > 1730 && g.grounded && collected >= 6) {
    g.status = 'won';
    g.score += g.lives * 500;
  }
  g.camera = clamp(g.x - 270, 0, 1080);
  g.message = `星星 ${collected} / 12 · 生命 ${g.lives}${g.x > 1690 && collected < 6 ? ' · 还需要 ' + (6 - collected) + ' 颗星' : ''}`;
}
function sokoban(g: Sokoban, i: Input) {
  if (g.solved) {
    if (tap(i, 'action')) {
      if (g.level + 1 === warehouseLevels.length) g.status = 'won';
      else loadWarehouse(g, g.level + 1);
    }
    return;
  }
  if (tap(i, 'extra')) {
    const prev = g.history.pop();
    if (prev) Object.assign(g, prev);
    return;
  }
  let dir = tap(i, 'left')
    ? -1
    : tap(i, 'right')
      ? 1
      : tap(i, 'up')
        ? -g.width
        : tap(i, 'down')
          ? g.width
          : 0;
  if (i.point) {
    const size = Math.min(50, 360 / g.height),
      ox = 360 - (g.width * size) / 2,
      oy = 60 + (360 - g.height * size) / 2;
    const x = Math.floor((i.point[0] - ox) / size),
      y = Math.floor((i.point[1] - oy) / size),
      p = y * g.width + x;
    if (
      x >= 0 &&
      x < g.width &&
      y >= 0 &&
      y < g.height &&
      Math.abs(x - (g.player % g.width)) +
        Math.abs(y - Math.floor(g.player / g.width)) ===
        1
    )
      dir = p - g.player;
  }
  if (!dir) return;
  const next = g.player + dir;
  if (g.walls.includes(next) || next < 0 || next >= g.width * g.height) return;
  const box = g.boxes.indexOf(next);
  if (
    box >= 0 &&
    (g.walls.includes(next + dir) || g.boxes.includes(next + dir))
  )
    return;
  g.history.push({ player: g.player, boxes: [...g.boxes], moves: g.moves });
  if (g.history.length > 500) g.history.shift();
  if (box >= 0) g.boxes[box] += dir;
  g.player = next;
  g.moves++;
  if (g.goals.every((p) => g.boxes.includes(p))) {
    g.solved = true;
    g.score += Math.max(100, 1000 - g.moves * 10);
    if (g.level === warehouseLevels.length - 1) g.status = 'won';
    else g.message = '完成！按空格进入下一间';
  }
}
export function reversiFlips(cells: number[], index: number, player: number) {
  if (index < 0 || index >= 64 || cells[index]) return [];
  const result: number[] = [];
  const x = index % 8,
    y = Math.floor(index / 8);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const line: number[] = [];
      let nx = x + dx,
        ny = y + dy;
      while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
        const p = ny * 8 + nx;
        if (cells[p] === 3 - player) line.push(p);
        else {
          if (cells[p] === player && line.length) result.push(...line);
          break;
        }
        nx += dx;
        ny += dy;
      }
    }
  return result;
}
export const reversiMoves = (cells: number[], p: number) =>
  cells.flatMap((_, j) => (reversiFlips(cells, j, p).length ? [j] : []));
export function reversiMove(g: Reversi, index: number) {
  const flips = reversiFlips(g.cells, index, g.turn);
  if (!flips.length) return false;
  g.cells[index] = g.turn;
  flips.forEach((p) => (g.cells[p] = g.turn));
  g.last = index;
  g.turn = g.turn === 1 ? 2 : 1;
  g.aiDelay = 0.52;
  g.passes = 0;
  if (!reversiMoves(g.cells, g.turn).length) {
    g.turn = g.turn === 1 ? 2 : 1;
    g.passes = 1;
    g.message =
      g.turn === 1 ? '白棋无处落子，黑棋继续' : '黑棋无处落子，白棋继续';
    if (!reversiMoves(g.cells, g.turn).length) {
      const black = g.cells.filter((c) => c === 1).length,
        white = g.cells.filter((c) => c === 2).length;
      g.score = black * 100;
      g.status = black >= white ? 'won' : 'lost';
      g.message =
        black === white ? '平局' : black > white ? '黑棋获胜' : '白棋获胜';
    }
  }
  return true;
}
function reversi(g: Reversi, dt: number, i: Input) {
  if (g.turn === 2) {
    g.aiDelay -= dt;
    if (g.aiDelay > 0) return;
    const choices = reversiMoves(g.cells, 2);
    let best = -Infinity,
      chosen = choices[0];
    for (const p of choices) {
      const cells = [...g.cells];
      cells[p] = 2;
      const flips = reversiFlips(g.cells, p, 2);
      flips.forEach((j) => (cells[j] = 2));
      const corner = [0, 7, 56, 63].includes(p),
        danger = [1, 8, 9, 6, 14, 15, 48, 49, 57, 54, 55, 62].includes(p);
      const value =
        (corner ? 120 : 0) -
        (danger ? 30 : 0) -
        reversiMoves(cells, 1).length * 3 +
        flips.length * (g.cells.filter(Boolean).length > 45 ? 3 : 0.3);
      if (value > best) {
        best = value;
        chosen = p;
      }
    }
    if (chosen !== undefined) reversiMove(g, chosen);
    return;
  }
  if (tap(i, 'left')) g.cursor = Math.max(0, g.cursor - 1);
  if (tap(i, 'right')) g.cursor = Math.min(63, g.cursor + 1);
  if (tap(i, 'up')) g.cursor = Math.max(0, g.cursor - 8);
  if (tap(i, 'down')) g.cursor = Math.min(63, g.cursor + 8);
  if (i.point) {
    const x = Math.floor((i.point[0] - 180) / 45),
      y = Math.floor((i.point[1] - 60) / 45);
    if (x >= 0 && x < 8 && y >= 0 && y < 8) {
      g.cursor = y * 8 + x;
      reversiMove(g, g.cursor);
    }
  }
  if (tap(i, 'action')) reversiMove(g, g.cursor);
}
function rhythm(g: Rhythm, dt: number, i: Input) {
  g.flash = Math.max(0, g.flash - dt);
  g.lanes = g.lanes.map((v) => Math.max(0, v - dt));
  for (let lane = 0; lane < 4; lane++)
    if (tap(i, `lane${lane}` as Control)) {
      g.lanes[lane] = 0.14;
      const note = g.notes.find(
        (n) => !n.judged && n.lane === lane && Math.abs(n.at - g.time) < 0.18,
      );
      if (note) {
        const perfect = Math.abs(note.at - g.time) < 0.075;
        note.judged = true;
        note.grade = perfect ? 2 : 1;
        g.hits++;
        g.combo++;
        g.bestCombo = Math.max(g.bestCombo, g.combo);
        g.score += (perfect ? 100 : 60) + Math.min(50, g.combo * 2);
        g.judgement = perfect ? 'PERFECT' : 'GOOD';
        g.health = clamp(g.health + 2, 0, 100);
      } else {
        g.combo = 0;
        g.health -= 3;
        g.judgement = 'EARLY';
      }
      g.flash = 0.3;
    }
  for (const n of g.notes)
    if (!n.judged && g.time > n.at + 0.18) {
      n.judged = true;
      n.grade = -1;
      g.misses++;
      g.combo = 0;
      g.health -= 5;
      g.judgement = 'MISS';
      g.flash = 0.3;
    }
  if (g.health <= 0) g.status = 'lost';
  else if (g.time > g.notes.at(-1)!.at + 0.5) {
    g.status = g.hits / g.notes.length >= 0.65 ? 'won' : 'lost';
    g.message = `命中 ${Math.round((g.hits / g.notes.length) * 100)}% · 最高连击 ${g.bestCombo}`;
  }
}
export function tickCabinet(g: CabinetGame, dt: number, i: Input) {
  if (g.status !== 'playing') return;
  dt = clamp(dt, 0, 0.04);
  g.time += dt;
  switch (g.id) {
    case 'pinball':
      pinball(g, dt, i);
      break;
    case 'racing':
      racing(g, dt, i);
      break;
    case 'shooter':
      shooter(g, dt, i);
      break;
    case 'platform':
      platform(g, dt, i);
      break;
    case 'sokoban':
      sokoban(g, i);
      break;
    case 'reversi':
      reversi(g, dt, i);
      break;
    case 'rhythm':
      rhythm(g, dt, i);
      break;
  }
}
