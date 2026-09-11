'use client';
// The mutable game simulation is repainted explicitly after each input/tick, alongside its 3D screen.
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  arcadeCommand,
  createArcade,
  createGomoku,
  emptyRecords,
  gameNames,
  gameStorageKey,
  gomokuReply,
  paintArcade,
  placeStone,
  readGameRecords,
  tickArcade,
  type ArcadeGame,
  type GameCommand,
  type GameId,
  type GameRecords,
  type Gomoku,
} from './game-engine';
import type { RoomApi } from './room-data';
export type PlaySelection = GameId | 'collection' | 'console' | null;
export default function GameRoomPanel({
  selection,
  onClose,
  onChoose,
  api,
}: {
  selection: PlaySelection;
  onClose: () => void;
  onChoose: (id: GameId) => void;
  api: React.RefObject<RoomApi | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    game = useRef<ArcadeGame | null>(null),
    board = useRef<Gomoku>(createGomoku());
  const [revision, redraw] = useState(0),
    [records, setRecords] = useState<GameRecords>(emptyRecords),
    [saved, setSaved] = useState(true),
    [duo, setDuo] = useState(false),
    [startedBoard, setStartedBoard] = useState(false);
  const recordsRef = useRef(records),
    awarded = useRef(false),
    aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const report = useCallback(
    (id: GameId, score: number, won: boolean) => {
      if (awarded.current) return;
      awarded.current = true;
      const next = {
        ...recordsRef.current,
        [id]: {
          best: Math.max(recordsRef.current[id].best, score),
          wins: recordsRef.current[id].wins + (won ? 1 : 0),
        },
      };
      recordsRef.current = next;
      setRecords(next);
      api.current?.setGameRecords(next);
      try {
        localStorage.setItem(gameStorageKey, JSON.stringify(next));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    },
    [api],
  );
  useEffect(() => {
    const initial = readGameRecords();
    recordsRef.current = initial;
    setRecords(initial);
    api.current?.setGameRecords(initial);
  }, [api]);
  const renderArcade = useCallback(() => {
    const g = game.current,
      c = canvas.current;
    if (!g || !c) return;
    paintArcade(c.getContext('2d')!, g);
    api.current?.setGameScreen(g.id, c);
    redraw((n) => n + 1);
    if (g.status === 'won' || g.status === 'lost')
      report(g.id, g.score, g.status === 'won');
  }, [api, report]);
  // Dialog content mounts through a portal after the selection effect has run.
  const mountCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvas.current = node;
      if (node) renderArcade();
    },
    [renderArcade],
  );
  useEffect(() => {
    const sceneApi = api.current;
    awarded.current = false;
    setStartedBoard(false);
    game.current =
      selection === 'blocks' || selection === 'snake'
        ? createArcade(selection)
        : null;
    board.current = createGomoku();
    renderArcade();
    redraw((n) => n + 1);
    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      sceneApi?.setGameScreen('blocks', null);
      sceneApi?.setGameScreen('snake', null);
    };
  }, [selection, api, renderArcade]);
  useEffect(() => {
    if (selection !== 'blocks' && selection !== 'snake') return;
    const timer = setInterval(
      () => {
        if (game.current?.status === 'playing') {
          tickArcade(game.current);
          renderArcade();
        }
      },
      selection === 'blocks' ? 600 : 170,
    );
    const hidden = () => {
      if (document.hidden && game.current?.status === 'playing') {
        game.current.status = 'paused';
        renderArcade();
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [selection, renderArcade]);
  const command = useCallback(
    (value: GameCommand) => {
      if (game.current) {
        arcadeCommand(game.current, value);
        renderArcade();
      }
    },
    [renderArcade],
  );
  const pause = useCallback(() => {
    if (!game.current) return;
    if (game.current.status === 'playing') game.current.status = 'paused';
    else if (
      game.current.status === 'paused' ||
      game.current.status === 'ready'
    )
      game.current.status = 'playing';
    renderArcade();
  }, [renderArcade]);
  useEffect(() => {
    if (selection !== 'blocks' && selection !== 'snake') return;
    const key = (e: KeyboardEvent) => {
      const cmd = {
        ArrowLeft: 'left',
        a: 'left',
        ArrowRight: 'right',
        d: 'right',
        ArrowUp: 'up',
        w: 'up',
        ArrowDown: 'down',
        s: 'down',
        ' ': 'drop',
      }[e.key] as GameCommand | undefined;
      if (cmd) {
        e.preventDefault();
        e.stopPropagation();
        command(cmd);
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        pause();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [selection, command, pause]);
  function restart() {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    awarded.current = false;
    if (selection === 'blocks' || selection === 'snake') {
      game.current = createArcade(selection);
      game.current.status = 'playing';
      renderArcade();
    } else {
      board.current = createGomoku();
      setStartedBoard(true);
      api.current?.setGameBoard(board.current.cells);
      redraw((n) => n + 1);
    }
  }
  function syncBoard() {
    api.current?.setGameBoard(board.current.cells);
    redraw((n) => n + 1);
    if (board.current.winner)
      report(
        'gomoku',
        board.current.winner === 3 ? 0 : 225 - board.current.moves.length,
        board.current.winner !== 3 && (duo || board.current.winner === 1),
      );
  }
  function move(index: number) {
    if (
      !startedBoard ||
      (!duo && board.current.turn === 2) ||
      !placeStone(board.current, index)
    )
      return;
    syncBoard();
    if (!duo && !board.current.winner)
      aiTimer.current = setTimeout(() => {
        placeStone(board.current, gomokuReply(board.current));
        syncBoard();
      }, 340);
  }
  const g = game.current,
    b = board.current;
  const status =
    selection === 'gomoku'
      ? !startedBoard
        ? '黑棋先手，连成五子即可获胜'
        : b.winner
          ? b.winner === 3
            ? '和棋，再来一局吧'
            : `${b.winner === 1 ? '黑棋' : '白棋'}获胜${duo || b.winner === 1 ? ' · 已获得五子棋奖牌' : ''}`
          : `${b.turn === 1 ? '黑棋' : '白棋'}回合${!duo && b.turn === 2 ? ' · 对手思考中' : ''}`
      : g?.status === 'won'
        ? '挑战完成 · 奖杯已放进收藏'
        : g?.status === 'lost'
          ? '本局结束 · 再来一次吧'
          : g?.status === 'paused'
            ? '已暂停'
            : g?.status === 'ready'
              ? '按开始，给自己一小段游戏时间'
              : `得分 ${g?.score ?? 0} · ${g?.progress ?? 0} / ${selection === 'blocks' ? '5 行' : '8 枚果实'}`;
  return (
    <Dialog
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={`play-dialog ${selection === 'gomoku' ? 'play-dialog-board' : ''}`}
        data-revision={revision}
      >
        <header className="play-heading">
          <div>
            <span className="play-eyebrow">SATORI · FREE PLAY</span>
            <DialogTitle>
              {selection && selection in gameNames
                ? gameNames[selection as GameId]
                : selection === 'console'
                  ? '家庭游戏角'
                  : '游戏收藏'}
            </DialogTitle>
          </div>
          <button
            className="play-icon"
            aria-label="返回游戏房"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <DialogDescription className="play-description">
          {selection === 'collection'
            ? '把今天的小小胜利，放进家里。'
            : selection === 'console'
              ? '赛车、平台跳跃与双人对战的下一站。'
              : selection === 'gomoku'
                ? '单人练习或同屏双人 · 棋子同步落在房间的圆桌上'
                : selection === 'blocks'
                  ? '消除 5 行赢取山丘奖杯 · ↑ 旋转，↓ 加速，空格落到底'
                  : '吃到 8 枚果实赢取花园奖杯 · 方向键或 WASD 移动'}
        </DialogDescription>
        {selection === 'collection' || selection === 'console' ? (
          <div className="play-library">
            {selection === 'console' && (
              <p className="play-coming">
                主机区目前播放赛车演示。首版开放以下三款游戏，点击卡片即可前往对应设备。
              </p>
            )}
            {(Object.keys(gameNames) as GameId[]).map((id, i) => (
              <button
                key={id}
                className="play-game-card"
                onClick={() => onChoose(id)}
              >
                <span className="play-card-number">0{i + 1}</span>
                <span>
                  <strong>{gameNames[id]}</strong>
                  <small>
                    {id === 'gomoku' ? '圆桌 · 单人 / 双人' : '街机 · 单人挑战'}
                  </small>
                  <small>
                    最高 {records[id].best} · 通关 {records[id].wins} 次
                  </small>
                </span>
                <Trophy
                  size={24}
                  className={records[id].wins ? 'play-earned' : 'play-unearned'}
                />
              </button>
            ))}
            <p className="play-storage">
              成绩保存在当前浏览器。每款游戏首次通关，会在房间里增加一件实体奖杯或奖牌。
            </p>
          </div>
        ) : (
          <>
            <output className="play-status" aria-live="polite">
              {status}
            </output>
            {selection === 'gomoku' ? (
              <>
                <div className="play-mode">
                  <button
                    aria-pressed={!duo}
                    disabled={startedBoard && !b.winner}
                    onClick={() => setDuo(false)}
                  >
                    单人练习
                  </button>
                  <button
                    aria-pressed={duo}
                    disabled={startedBoard && !b.winner}
                    onClick={() => setDuo(true)}
                  >
                    同屏双人
                  </button>
                  <span>自由五子棋 · 无禁手</span>
                </div>
                <fieldset className="play-gomoku" aria-label="十五路五子棋棋盘">
                  {b.cells.map((stone, i) => (
                    <button
                      key={i}
                      aria-label={`${Math.floor(i / 15) + 1}行${(i % 15) + 1}列${stone ? (stone === 1 ? ' 黑棋' : ' 白棋') : ' 空位'}`}
                      disabled={
                        !startedBoard ||
                        !!stone ||
                        !!b.winner ||
                        (!duo && b.turn === 2)
                      }
                      onClick={() => move(i)}
                      className={`${stone ? `stone-${stone}` : ''} ${b.line.includes(i) ? 'stone-win' : ''} ${b.moves.at(-1) === i ? 'stone-last' : ''}`}
                    >
                      <span />
                    </button>
                  ))}
                </fieldset>
              </>
            ) : (
              <canvas
                ref={mountCanvas}
                width={400}
                height={520}
                className="play-screen"
                aria-label={`${selection === 'blocks' ? '俄罗斯方块' : '贪吃蛇'}游戏画面`}
              />
            )}
            <div className="play-actions">
              {selection !== 'gomoku' &&
                !['won', 'lost'].includes(g?.status || '') && (
                  <button className="play-primary" onClick={pause}>
                    {g?.status === 'playing' ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} />
                    )}
                    {g?.status === 'playing'
                      ? '暂停'
                      : g?.status === 'ready'
                        ? '开始游戏'
                        : '继续'}
                  </button>
                )}
              <button
                className={selection === 'gomoku' ? 'play-primary' : ''}
                onClick={restart}
              >
                <RotateCcw size={16} />
                {selection === 'gomoku' && !startedBoard
                  ? '开始对局'
                  : '重新开始'}
              </button>
              <button onClick={onClose}>返回房间</button>
            </div>
            {selection !== 'gomoku' && (
              <div className="play-controls" aria-label="触屏游戏按键">
                <button
                  aria-label={selection === 'blocks' ? '旋转方块' : '向上'}
                  onClick={() => command('up')}
                >
                  <ArrowUp />
                </button>
                <div>
                  <button aria-label="向左" onClick={() => command('left')}>
                    <ArrowLeft />
                  </button>
                  <button aria-label="向下" onClick={() => command('down')}>
                    <ArrowDown />
                  </button>
                  <button aria-label="向右" onClick={() => command('right')}>
                    <ArrowRight />
                  </button>
                  {selection === 'blocks' && (
                    <button onClick={() => command('drop')}>落到底</button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {!saved && (
          <output className="play-storage">
            浏览器未能保存成绩，本次游玩记录仍保留在当前页面。
          </output>
        )}
      </DialogContent>
    </Dialog>
  );
}
