export type GameId = 'blocks' | 'snake' | 'gomoku';
export type GameStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost';
export type GameCommand = 'left' | 'right' | 'up' | 'down' | 'drop';
export const gameNames: Record<GameId, string> = {
  blocks: '俄罗斯方块',
  snake: '贪吃蛇',
  gomoku: '五子棋',
};
export const gameObjectIds = {
  arcadeBlocks: 'blocks',
  arcadeSnake: 'snake',
  gameTable: 'gomoku',
} as const;
export type ArcadeGame = {
  id: 'blocks' | 'snake';
  status: GameStatus;
  score: number;
  progress: number;
  board: number[][];
  piece: number[][];
  x: number;
  y: number;
  snake: [number, number][];
  direction: [number, number];
  queued: [number, number];
  food: [number, number];
};
const shapes = [
  [[1, 1, 1, 1]],
  [
    [2, 2],
    [2, 2],
  ],
  [
    [0, 3, 0],
    [3, 3, 3],
  ],
  [
    [0, 4, 4],
    [4, 4, 0],
  ],
  [
    [5, 5, 0],
    [0, 5, 5],
  ],
  [
    [6, 0, 0],
    [6, 6, 6],
  ],
  [
    [0, 0, 7],
    [7, 7, 7],
  ],
];
const blank = (w: number, h: number) =>
  Array.from({ length: h }, () => Array<number>(w).fill(0));
export function createArcade(
  id: 'blocks' | 'snake',
  random = Math.random,
): ArcadeGame {
  const game: ArcadeGame = {
    id,
    status: 'ready',
    score: 0,
    progress: 0,
    board: blank(10, 18),
    piece: [],
    x: 3,
    y: 0,
    snake: [
      [5, 8],
      [4, 8],
      [3, 8],
    ],
    direction: [1, 0],
    queued: [1, 0],
    food: [10, 8],
  };
  spawnPiece(game, random);
  return game;
}
function spawnPiece(g: ArcadeGame, random: () => number) {
  g.piece = shapes[Math.min(6, Math.floor(random() * shapes.length))].map(
    (r) => [...r],
  );
  g.x = Math.floor((10 - g.piece[0].length) / 2);
  g.y = 0;
  if (collides(g, g.x, g.y, g.piece)) g.status = 'lost';
}
function collides(g: ArcadeGame, x: number, y: number, piece: number[][]) {
  return piece.some((row, j) =>
    row.some(
      (v, i) =>
        v &&
        (x + i < 0 ||
          x + i >= 10 ||
          y + j >= 18 ||
          (y + j >= 0 && g.board[y + j][x + i] !== 0)),
    ),
  );
}
export function arcadeCommand(g: ArcadeGame, command: GameCommand) {
  if (g.status !== 'playing') return;
  if (g.id === 'snake') {
    const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[
      command as Exclude<GameCommand, 'drop'>
    ] as [number, number] | undefined;
    // Compare against the last committed direction, so rapid key presses cannot reverse into the neck.
    if (d && !(d[0] === -g.direction[0] && d[1] === -g.direction[1]))
      g.queued = d;
    return;
  }
  if (command === 'left' || command === 'right') {
    const x = g.x + (command === 'left' ? -1 : 1);
    if (!collides(g, x, g.y, g.piece)) g.x = x;
  } else if (command === 'up') {
    const rotated = g.piece[0].map((_, i) =>
      g.piece.map((row) => row[i]).reverse(),
    );
    for (const shift of [0, -1, 1, -2, 2])
      if (!collides(g, g.x + shift, g.y, rotated)) {
        g.piece = rotated;
        g.x += shift;
        break;
      }
  } else if (command === 'drop') {
    while (!collides(g, g.x, g.y + 1, g.piece)) {
      g.y++;
      g.score += 2;
    }
    tickArcade(g);
  } else if (!collides(g, g.x, g.y + 1, g.piece)) {
    g.y++;
    g.score++;
  }
}
export function tickArcade(g: ArcadeGame, random = Math.random) {
  if (g.status !== 'playing') return;
  if (g.id === 'blocks') {
    if (!collides(g, g.x, g.y + 1, g.piece)) {
      g.y++;
      return;
    }
    g.piece.forEach((row, j) =>
      row.forEach((v, i) => {
        if (v) g.board[g.y + j][g.x + i] = v;
      }),
    );
    const rows = g.board.filter((row) => row.some((v) => !v));
    const cleared = 18 - rows.length;
    g.board = [...blank(10, cleared), ...rows];
    g.progress += cleared;
    g.score += [0, 100, 300, 500, 800][cleared];
    if (g.progress >= 5) g.status = 'won';
    else spawnPiece(g, random);
  } else {
    g.direction = [...g.queued];
    const head: [number, number] = [
      g.snake[0][0] + g.direction[0],
      g.snake[0][1] + g.direction[1],
    ];
    const eating = head[0] === g.food[0] && head[1] === g.food[1];
    if (
      head.some((v) => v < 0 || v >= 16) ||
      g.snake
        .slice(0, eating ? undefined : -1)
        .some((p) => p[0] === head[0] && p[1] === head[1])
    ) {
      g.status = 'lost';
      return;
    }
    g.snake.unshift(head);
    if (!eating) g.snake.pop();
    else {
      g.progress++;
      g.score += 100;
      if (g.progress >= 8) {
        g.status = 'won';
        return;
      }
      const free: [number, number][] = [];
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++)
          if (!g.snake.some((p) => p[0] === x && p[1] === y)) free.push([x, y]);
      g.food =
        free[Math.min(free.length - 1, Math.floor(random() * free.length))];
    }
  }
}
export const stoneColors = [
  '#1f2b27',
  '#71a195',
  '#dab465',
  '#c38566',
  '#bacb9c',
  '#e7d4ae',
  '#89a7ba',
  '#a796b4',
];
export function paintArcade(
  ctx: CanvasRenderingContext2D,
  g: ArcadeGame,
  demo = false,
) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.fillStyle = '#152b26';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#cbd9b6';
  ctx.font = `600 ${w * 0.042}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(
    g.id === 'blocks' ? 'HILLS / BLOCKS' : 'GARDEN / SNAKE',
    w * 0.06,
    h * 0.07,
  );
  ctx.font = `${w * 0.035}px monospace`;
  ctx.fillText(
    `SCORE ${String(g.score).padStart(5, '0')}`,
    w * 0.06,
    h * 0.125,
  );
  const cols = g.id === 'blocks' ? 10 : 16,
    rows = g.id === 'blocks' ? 18 : 16;
  const cell = Math.min((w * 0.86) / cols, (h * 0.72) / rows),
    ox = (w - cols * cell) / 2,
    oy = h * 0.18;
  ctx.fillStyle = '#0e201b';
  ctx.fillRect(ox - 3, oy - 3, cell * cols + 6, cell * rows + 6);
  const square = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2);
    ctx.fillStyle = '#ffffff25';
    ctx.fillRect(
      ox + x * cell + 2,
      oy + y * cell + 2,
      cell - 4,
      Math.max(2, cell * 0.12),
    );
  };
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) square(x, y, '#1b332b');
  if (g.id === 'blocks') {
    g.board.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) square(x, y, stoneColors[v]);
      }),
    );
    g.piece.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) square(x + g.x, y + g.y, stoneColors[v]);
      }),
    );
  } else {
    g.snake.forEach(([x, y], i) => square(x, y, i ? '#8bab6e' : '#d6e7a6'));
    square(...g.food, '#df9b68');
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d6dfb7';
  ctx.font = `${w * 0.034}px monospace`;
  ctx.fillText(
    demo
      ? 'PRESS START · FREE PLAY'
      : g.id === 'blocks'
        ? `${g.progress} / 5 LINES`
        : `${g.progress} / 8 FRUITS`,
    w / 2,
    h * 0.965,
  );
}
export type Stone = 0 | 1 | 2;
export type Gomoku = {
  cells: Stone[];
  turn: 1 | 2;
  winner: Stone | 3;
  moves: number[];
  line: number[];
};
export function createGomoku(): Gomoku {
  return {
    cells: Array<Stone>(225).fill(0),
    turn: 1,
    winner: 0,
    moves: [],
    line: [],
  };
}
export function placeStone(g: Gomoku, index: number): boolean {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 225 ||
    g.cells[index] ||
    g.winner
  )
    return false;
  const stone = g.turn;
  g.cells[index] = stone;
  g.moves.push(index);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]) {
    const line = [index];
    for (const sign of [-1, 1])
      for (let step = 1; step < 15; step++) {
        const x = (index % 15) + dx * step * sign,
          y = Math.floor(index / 15) + dy * step * sign;
        if (
          x < 0 ||
          x >= 15 ||
          y < 0 ||
          y >= 15 ||
          g.cells[y * 15 + x] !== stone
        )
          break;
        line.push(y * 15 + x);
      }
    if (line.length >= 5) {
      g.winner = stone;
      g.line = line;
      return true;
    }
  }
  if (g.moves.length === 225) g.winner = 3;
  g.turn = stone === 1 ? 2 : 1;
  return true;
}
// A small local opponent: take a win, block an immediate loss, then prefer open lines.
export function gomokuReply(g: Gomoku): number {
  let best = -1,
    bestScore = -Infinity;
  for (let index = 0; index < 225; index++) {
    if (g.cells[index]) continue;
    let score = 14 - Math.hypot((index % 15) - 7, Math.floor(index / 15) - 7);
    for (const color of [g.turn, g.turn === 1 ? 2 : 1] as const) {
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ]) {
        let count = 1,
          open = 0;
        for (const sign of [-1, 1])
          for (let step = 1; step <= 5; step++) {
            const x = (index % 15) + dx * step * sign,
              y = Math.floor(index / 15) + dy * step * sign;
            if (x < 0 || x > 14 || y < 0 || y > 14) break;
            const v = g.cells[y * 15 + x];
            if (v !== color) {
              if (!v) open++;
              break;
            }
            count++;
          }
        score +=
          count >= 5
            ? color === g.turn
              ? 1e8
              : 1e6
            : Math.pow(8, count) * open * (color === g.turn ? 1.1 : 1);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}
export type GameRecords = Record<GameId, { best: number; wins: number }>;
export const emptyRecords = (): GameRecords => ({
  blocks: { best: 0, wins: 0 },
  snake: { best: 0, wins: 0 },
  gomoku: { best: 0, wins: 0 },
});
export const gameStorageKey = 'satori-play-room-v1';
export function readGameRecords(): GameRecords {
  const result = emptyRecords();
  try {
    const data = JSON.parse(localStorage.getItem(gameStorageKey) || '{}');
    for (const id of Object.keys(result) as GameId[])
      for (const field of ['best', 'wins'] as const) {
        const n = data[id]?.[field];
        if (Number.isSafeInteger(n) && n >= 0)
          result[id][field] = Math.min(n, 9999999);
      }
  } catch {
    /* A blocked browser store still allows an in-memory play session. */
  }
  return result;
}
