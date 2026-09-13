'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  cabinetIds,
  cabinetInfo,
  createCabinet,
  loadWarehouse,
  emptyInput,
  tickCabinet,
  type CabinetGame,
  type CabinetId,
  type Control,
} from './cabinet-engine';
import { paintCabinet } from './cabinet-painter';
import {
  createArcade,
  paintArcade,
  gameNames,
  gameStorageKey,
  readGameRecords,
  type GameId,
} from './game-engine';
import type { RoomApi } from './room-data';

const arcadeIds: GameId[] = ['blocks', 'snake', 'pinball'];
const consoleIds = cabinetIds.filter((id) => id !== 'pinball');
function Thumbnail({ id }: { id: GameId }) {
  const mount = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node) return;
      const ctx = node.getContext('2d')!;
      if (id === 'blocks' || id === 'snake') {
        const g = createArcade(id, () => 0.3);
        g.y = 7;
        if (id === 'blocks')
          for (let y = 13; y < 18; y++)
            for (let x = 0; x < 10; x++)
              g.board[y][x] = (x + y) % 3 ? ((x + y) % 7) + 1 : 0;
        else
          g.snake = [
            [8, 6],
            [7, 6],
            [6, 6],
            [5, 6],
            [5, 7],
            [5, 8],
            [4, 8],
            [3, 8],
          ];
        paintArcade(ctx, g, true);
      } else if (id !== 'gomoku') {
        const g = createCabinet(id);
        g.status = 'playing';
        if (g.id === 'pinball') {
          g.x = 338;
          g.y = 300;
        }
        if (g.id === 'rhythm') g.time = 3;
        if (g.id === 'shooter') tickCabinet(g, 0.01, emptyInput());
        paintCabinet(ctx, g, emptyInput());
      }
    },
    [id],
  );
  return <canvas ref={mount} width={720} height={480} aria-hidden="true" />;
}
export function GameLibrary({
  consoleOnly,
  onChoose,
  onClose,
}: {
  consoleOnly: boolean;
  onChoose: (id: GameId) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="play-dialog play-catalog-dialog"
      >
        <header className="play-heading">
          <div>
            <span className="play-eyebrow">SATORI · FREE PLAY</span>
            <DialogTitle>{consoleOnly ? '主机游戏' : '游戏厅'}</DialogTitle>
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
          {consoleOnly ? '六张卡带，随时开玩。' : '三台街机，六款主机游戏。'}
        </DialogDescription>
        {(consoleOnly
          ? [{ title: 'CONSOLE / 主机', ids: consoleIds }]
          : [
              { title: 'ARCADE / 街机', ids: arcadeIds },
              { title: 'CONSOLE / 主机', ids: consoleIds },
            ]
        ).map((section) => (
          <section className="cabinet-library-section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="cabinet-library-grid">
              {section.ids.map((id) => {
                const info =
                  id in cabinetInfo ? cabinetInfo[id as CabinetId] : null;
                return (
                  <button
                    className="cabinet-card"
                    key={id}
                    onClick={() => onChoose(id)}
                  >
                    <Thumbnail id={id} />
                    <div>
                      <small>
                        {info?.genre ||
                          (id === 'blocks' ? '落块消行' : '网格生存')}
                      </small>
                      <strong>{gameNames[id]}</strong>
                      <span>
                        <Play size={13} />
                        开始游玩
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {!consoleOnly && (
          <button
            className="cabinet-table-link"
            onClick={() => onChoose('gomoku')}
          >
            圆桌五子棋 <span>单人 / 同屏双人 →</span>
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
class GameAudio {
  context: AudioContext | null = null;
  voices = new Set<OscillatorNode>();
  nextNote = 0;
  nextBeat = 0;
  muted = false;
  open() {
    if (!this.context)
      this.context = new AudioContext({ latencyHint: 'interactive' });
    void this.context.resume().catch(() => {});
  }
  tone(
    frequency: number,
    duration: number,
    delay = 0,
    volume = 0.035,
    type: OscillatorType = 'sine',
  ) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const at = this.context.currentTime + Math.max(0, delay),
      osc = this.context.createOscillator(),
      gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start(at);
    osc.stop(at + duration + 0.01);
    this.voices.add(osc);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.voices.delete(osc);
    };
  }
  stop(time = 0) {
    for (const osc of this.voices) {
      try {
        osc.stop();
      } catch {
        /* already ended */
      }
    }
    this.voices.clear();
    this.nextNote = time;
    this.nextBeat = time;
  }
  sync(g: CabinetGame) {
    if (g.id !== 'rhythm' || g.status !== 'playing') return;
    const ahead = g.time + 0.075;
    for (const n of g.notes)
      if (n.at >= this.nextNote && n.at < ahead) {
        this.tone(
          [261.63, 329.63, 392, 523.25][n.lane],
          0.24,
          n.at - g.time,
          0.028,
          'triangle',
        );
      }
    this.nextNote = ahead;
    const beat = Math.ceil(this.nextBeat * 2);
    for (let b = beat; b * 0.5 < ahead; b++) {
      this.tone(
        b % 4 === 0 ? 110 : 220,
        0.07,
        b * 0.5 - g.time,
        b % 4 === 0 ? 0.045 : 0.018,
      );
      if (b % 4 === 0)
        this.tone(
          [130.81, 164.81, 174.61, 146.83][Math.floor(b / 4) % 4],
          0.4,
          b * 0.5 - g.time,
          0.022,
          'triangle',
        );
    }
    this.nextBeat = ahead;
  }
  close() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
export default function CabinetPlayer({
  id,
  onClose,
  onLibrary,
  api,
}: {
  id: CabinetId;
  onClose: () => void;
  onLibrary: () => void;
  api: React.RefObject<RoomApi | null>;
}) {
  const game = useRef<CabinetGame>(createCabinet(id)),
    input = useRef(emptyInput()),
    canvas = useRef<HTMLCanvasElement | null>(null),
    audio = useRef<GameAudio | null>(null),
    awarded = useRef(false),
    lastUi = useRef(0);
  const [state, setState] = useState({
      status: game.current.status,
      score: 0,
      message: '',
    }),
    [muted, setMuted] = useState(false),
    [saved, setSaved] = useState(true);
  const info = cabinetInfo[id];
  const sync = useCallback(() => {
    const g = game.current;
    setState({ status: g.status, score: g.score, message: g.message });
  }, []);
  const pause = useCallback(() => {
    const g = game.current;
    if (g.status === 'won' || g.status === 'lost') return;
    if (g.status === 'playing') {
      g.status = 'paused';
      audio.current?.stop(g.time);
    } else {
      audio.current ??= new GameAudio();
      audio.current.open();
      audio.current.stop(g.time);
      g.status = 'playing';
    }
    input.current = emptyInput();
    sync();
  }, [sync]);
  const press = useCallback((control: Control) => {
    input.current.held.add(control);
    input.current.pressed.add(control);
  }, []);
  const release = useCallback((control: Control) => {
    input.current.held.delete(control);
  }, []);
  useEffect(() => {
    let frame = 0,
      last = 0,
      screenAt = 0,
      repeatAt = 0;
    const scene = api.current;
    const animate = (now: number) => {
      const g = game.current,
        dt = last ? Math.min(0.04, (now - last) / 1000) : 0;
      last = now;
      if ((id === 'sokoban' || id === 'reversi') && now > repeatAt) {
        for (const key of input.current.held)
          if (['left', 'right', 'up', 'down'].includes(key))
            input.current.pressed.add(key);
        repeatAt = now + 170;
      }
      tickCabinet(g, dt, input.current);
      audio.current?.sync(g);
      const c = canvas.current;
      if (c) {
        paintCabinet(c.getContext('2d')!, g, input.current);
        c.dataset.status = g.status;
        c.dataset.score = String(g.score);
        if (now - screenAt > 100) {
          if (g.id === 'pinball')
            scene?.setPinballState({
              x: g.x,
              y: g.y,
              left: input.current.held.has('left'),
              right: input.current.held.has('right'),
              score: g.score,
            });
          else scene?.setGameScreen('console', c);
          screenAt = now;
        }
      }
      input.current.pressed.clear();
      delete input.current.point;
      if ((g.status === 'won' || g.status === 'lost') && !awarded.current) {
        awarded.current = true;
        const records = readGameRecords();
        records[id].best = Math.max(g.score, records[id].best);
        records[id].wins += Number(g.status === 'won');
        scene?.setGameRecords(records);
        try {
          localStorage.setItem(gameStorageKey, JSON.stringify(records));
        } catch {
          setSaved(false);
        }
        audio.current?.stop();
        audio.current?.tone(g.status === 'won' ? 523 : 196, 0.3);
      }
      if (now - lastUi.current > 120) {
        lastUi.current = now;
        sync();
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const stop = () => {
      input.current = emptyInput();
      if (game.current.status === 'playing') {
        game.current.status = 'paused';
        audio.current?.stop(game.current.time);
        sync();
      }
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    // Read-only local diagnostics let browser QA verify real inputs without shipping cheats.
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (local)
      Object.assign(window, {
        __kuroGame: () => JSON.parse(JSON.stringify(game.current)),
      });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibility);
      scene?.setGameScreen('console', null);
      scene?.setPinballState(null);
      audio.current?.close();
      if (local)
        delete (window as unknown as Record<string, unknown>).__kuroGame;
    };
  }, [id, api, sync]);
  useEffect(() => {
    const mapping: Record<string, Control> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      a: 'left',
      d: 'right',
      w: 'up',
      s: 'down',
      ' ': 'action',
      x: 'extra',
    };
    if (id === 'rhythm')
      Object.assign(mapping, {
        d: 'lane0',
        f: 'lane1',
        j: 'lane2',
        k: 'lane3',
        ArrowLeft: 'lane0',
        ArrowDown: 'lane1',
        ArrowUp: 'lane2',
        ArrowRight: 'lane3',
      });
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key,
        control = mapping[k];
      if (k === 'p' || k === 'Enter') {
        if (e.type === 'keydown' && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          pause();
        }
        return;
      }
      if (control) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'keydown') {
          if (!e.repeat) press(control);
        } else release(control);
      }
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
    };
  }, [id, pause, press, release]);
  const restart = () => {
    game.current = createCabinet(id);
    game.current.status = 'playing';
    awarded.current = false;
    input.current = emptyInput();
    audio.current ??= new GameAudio();
    audio.current.open();
    audio.current.stop();
    sync();
  };
  const pad = (control: Control, label: string, icon?: React.ReactNode) => (
    <button
      key={control}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        press(control);
      }}
      onPointerUp={() => release(control)}
      onPointerCancel={() => release(control)}
      onLostPointerCapture={() => release(control)}
      onClick={(e) => {
        if (e.detail === 0) {
          press(control);
          release(control);
        }
      }}
    >
      {icon || label}
    </button>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="play-dialog cabinet-player"
      >
        <header className="play-heading">
          <div>
            <span className="play-eyebrow">{info.english}</span>
            <DialogTitle>{info.title}</DialogTitle>
          </div>
          <div className="cabinet-header-actions">
            <button
              className="play-icon"
              aria-label={muted ? '开启游戏声音' : '关闭游戏声音'}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                audio.current ??= new GameAudio();
                audio.current.muted = next;
                if (next) audio.current.stop(game.current.time);
                else audio.current.open();
              }}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              className="play-icon"
              aria-label="返回游戏房"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <DialogDescription className="play-description">
          {info.goal}
        </DialogDescription>
        <canvas
          ref={canvas}
          className="cabinet-screen"
          width={720}
          height={480}
          aria-label={`${info.title}游戏画面`}
          tabIndex={0}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            input.current.point = [
              ((e.clientX - r.left) * 720) / r.width,
              ((e.clientY - r.top) * 480) / r.height,
            ];
          }}
        />
        <div className="cabinet-readout">
          <output aria-live="off">
            {state.message || `得分 ${state.score}`}
          </output>
          <output aria-live="polite">
            {state.status === 'paused'
              ? '已暂停'
              : state.status === 'won'
                ? '挑战完成'
                : state.status === 'lost'
                  ? '本局结束'
                  : ''}
          </output>
        </div>
        <div className="play-actions">
          {!['won', 'lost'].includes(state.status) && (
            <button className="play-primary" onClick={pause}>
              {state.status === 'playing' ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}{' '}
              {state.status === 'playing'
                ? '暂停'
                : state.status === 'ready'
                  ? '开始游戏'
                  : '继续'}
            </button>
          )}
          {id === 'sokoban' && (
            <button
              disabled={game.current.id !== 'sokoban' || game.current.solved}
              onClick={() => {
                const g = game.current;
                if (g.id === 'sokoban' && !g.solved) {
                  loadWarehouse(g, g.level);
                  input.current = emptyInput();
                  sync();
                }
              }}
            >
              重置本关
            </button>
          )}
          <button onClick={restart}>
            <RotateCcw size={15} />
            重新开始
          </button>
          <button onClick={onLibrary}>游戏库</button>
        </div>
        <div
          className={`cabinet-controls ${id === 'rhythm' ? 'cabinet-rhythm-pads' : ''}`}
          aria-label="触屏游戏按键"
        >
          {id === 'rhythm' ? (
            ['D', 'F', 'J', 'K'].map((label, j) =>
              pad(`lane${j}` as Control, label),
            )
          ) : (
            <>
              <div className="cabinet-directions">
                {pad(
                  'left',
                  id === 'pinball' ? '左挡板' : '向左',
                  <ArrowLeft />,
                )}
                {id !== 'pinball' && (
                  <div>
                    {pad('up', id === 'racing' ? '油门' : '向上', <ArrowUp />)}
                    {pad(
                      'down',
                      id === 'racing' ? '刹车' : '向下',
                      <ArrowDown />,
                    )}
                  </div>
                )}
                {pad(
                  'right',
                  id === 'pinball' ? '右挡板' : '向右',
                  <ArrowRight />,
                )}
              </div>
              <div className="cabinet-action-pads">
                {pad(
                  'action',
                  id === 'pinball'
                    ? '发球'
                    : id === 'racing'
                      ? '加速'
                      : id === 'platform'
                        ? '跳跃'
                        : id === 'shooter'
                          ? '射击'
                          : id === 'sokoban'
                            ? '下一关'
                            : '落子',
                )}
                {(id === 'shooter' || id === 'sokoban') &&
                  pad('extra', id === 'shooter' ? '脉冲' : '撤销')}
              </div>
            </>
          )}
        </div>
        <p className="cabinet-keyboard">{info.controls} · P 暂停</p>
        {!saved && (
          <output className="play-storage">本次成绩暂时无法保存。</output>
        )}
      </DialogContent>
    </Dialog>
  );
}
