'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Square,
  RotateCcw,
  Wine,
  Disc3,
  Crosshair,
  Snowflake,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  barDrinks,
  barRecords,
  mixLabels,
  paintDartboard,
  addDart,
  dartTotal,
  readDartBest,
  type BarSnapshot,
  type BarDrink,
  type DartHit,
} from './bar-state';
import { playBarRecord } from './bar-audio';
import type { RoomApi } from './room-data';
import type { HouseView } from './house-data';
export type BarSelection = 'mix' | 'record' | 'fridge' | 'darts' | null;
export const barObjectIds = {
  barMix: 'mix',
  barRecord: 'record',
  barFridge: 'fridge',
  barDarts: 'darts',
} as const;
const initial: BarSnapshot = {
  drink: 'citrus',
  phase: 'idle',
  age: 0,
  fridgeOpen: false,
  record: null,
};
export default function BarRoomPanel({
  selection,
  onClose,
  api,
  view,
  globalMusic,
  onRecordPlay,
}: {
  selection: BarSelection;
  onClose: () => void;
  api: React.RefObject<RoomApi | null>;
  view: HouseView;
  globalMusic: boolean;
  onRecordPlay: () => void;
}) {
  const [snapshot, setSnapshot] = useState(initial),
    [choice, setChoice] = useState<BarDrink>('citrus'),
    [track, setTrack] = useState<number | null>(null),
    [error, setError] = useState('');
  const player = useRef<Awaited<ReturnType<typeof playBarRecord>> | null>(null),
    request = useRef(0);
  const [hits, setHits] = useState<DartHit[]>([]),
    [phase, setPhase] = useState<'x' | 'y'>('x'),
    [best, setBest] = useState(0),
    [saved, setSaved] = useState(true);
  const hitsRef = useRef(hits),
    phaseRef = useRef(phase),
    aim = useRef({ x: 0, y: 0 }),
    canvas = useRef<HTMLCanvasElement | null>(null),
    cooldown = useRef(0),
    clock = useRef(0);
  const stop = useCallback(() => {
    request.current++;
    player.current?.close();
    player.current = null;
    setTrack(null);
    api.current?.setBarRecord(null);
  }, [api]);
  useEffect(() => {
    if ((view !== 'bar' && view !== 'overview') || globalMusic) stop();
  }, [view, globalMusic, stop]);
  useEffect(
    () => () => {
      request.current++;
      player.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!selection) return;
    setSnapshot(api.current?.barSnapshot() || initial);
    setBest(readDartBest());
    const t = setInterval(
      () => setSnapshot(api.current?.barSnapshot() || initial),
      100,
    );
    return () => clearInterval(t);
  }, [selection, api]);
  async function play(index: number) {
    stop();
    onRecordPlay();
    setError('');
    const id = ++request.current;
    try {
      const audio = await playBarRecord(index);
      if (id !== request.current) {
        audio.close();
        return;
      }
      player.current = audio;
      setTrack(index);
      api.current?.setBarRecord(index);
    } catch {
      setError('声音未能开启，请再按一次播放。');
    }
  }
  const restart = () => {
    hitsRef.current = [];
    setHits([]);
    phaseRef.current = 'x';
    setPhase('x');
    aim.current = { x: 0, y: 0 };
    api.current?.setBarDarts([]);
    cooldown.current = 0;
  };
  const throwDart = useCallback(() => {
    if (
      document.hidden ||
      hitsRef.current.length >= 9 ||
      performance.now() < cooldown.current
    )
      return;
    if (phaseRef.current === 'x') {
      phaseRef.current = 'y';
      setPhase('y');
      return;
    }
    const next = addDart(hitsRef.current, aim.current.x, aim.current.y);
    hitsRef.current = next;
    setHits(next);
    api.current?.setBarDarts(next);
    phaseRef.current = 'x';
    setPhase('x');
    cooldown.current = performance.now() + 450;
    if (next.length === 9) {
      const high = Math.max(readDartBest(), dartTotal(next));
      setBest(high);
      try {
        localStorage.setItem('satori-bar-darts-best', String(high));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }
  }, [api]);
  useEffect(() => {
    if (selection !== 'darts') return;
    let frame = 0,
      previous = performance.now();
    function paint(t: number) {
      const dt = Math.min(t - previous, 50);
      previous = t;
      if (!document.hidden) clock.current += dt;
      const c = canvas.current?.getContext('2d');
      if (c) {
        paintDartboard(c, 480);
        const r = 480 / 2.42;
        if (hitsRef.current.length < 9) {
          if (phaseRef.current === 'x')
            aim.current.x = Math.sin(clock.current * 0.00185) * 1.06;
          aim.current.y =
            phaseRef.current === 'y'
              ? Math.sin(clock.current * 0.00215) * 1.06
              : 0;
        }
        for (const hit of hitsRef.current) {
          c.fillStyle = '#d99643';
          c.beginPath();
          c.arc(240 + hit.x * r, 240 + hit.y * r, 5, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#fff5da';
          c.lineWidth = 1.5;
          c.stroke();
        }
        if (hitsRef.current.length < 9) {
          const x = 240 + aim.current.x * r,
            y = 240 + aim.current.y * r;
          c.strokeStyle = '#efb653';
          c.lineWidth = 2;
          c.setLineDash([5, 4]);
          c.beginPath();
          c.moveTo(x, 42);
          c.lineTo(x, 438);
          if (phaseRef.current === 'y') {
            c.moveTo(42, y);
            c.lineTo(438, y);
          }
          c.stroke();
          c.setLineDash([]);
          c.strokeStyle = '#fff7dd';
          c.beginPath();
          c.arc(x, y, 8, 0, Math.PI * 2);
          c.stroke();
        }
      }
      frame = requestAnimationFrame(paint);
    }
    frame = requestAnimationFrame(paint);
    const key = (event: KeyboardEvent) => {
      if (
        (event.code === 'Space' || event.code === 'Enter') &&
        !event.repeat &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        throwDart();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', key);
    };
  }, [selection, throwDart]);
  const busy = snapshot.phase !== 'idle' && snapshot.phase !== 'ready',
    finished = hits.length === 9;
  return (
    <Dialog
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bar-overlay"
        className={`bar-dialog ${selection === 'darts' ? 'bar-dialog-darts' : ''}`}
      >
        <header className="play-heading">
          <div>
            <span className="play-eyebrow">AMBER · 琥珀小酒馆</span>
            <DialogTitle>
              {selection === 'mix'
                ? '给自己调一杯'
                : selection === 'record'
                  ? '今晚，听这张'
                  : selection === 'fridge'
                    ? '吧台冷藏柜'
                    : '九镖小局'}
            </DialogTitle>
          </div>
          <button className="play-icon" aria-label="返回酒吧" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <DialogDescription className="play-description">
          {selection === 'mix'
            ? '选好味道，看吧台上的器具完成这一杯。'
            : selection === 'record'
              ? '三段原创小曲，陪你在小酒馆坐一会儿。'
              : selection === 'fridge'
                ? '打开柜门，看看为今晚准备的饮料。'
                : '先定左右，再定上下。九镖累计计分，180 分达成挑战。'}
        </DialogDescription>
        {selection === 'mix' && (
          <>
            <div className="bar-choices">
              {Object.entries(barDrinks).map(([id, d]) => (
                <button
                  key={id}
                  aria-pressed={choice === id}
                  disabled={busy}
                  onClick={() => setChoice(id as BarDrink)}
                >
                  <Wine style={{ color: d.color }} />
                  <strong>{d.name}</strong>
                  <small>{d.detail}</small>
                </button>
              ))}
            </div>
            <output className="bar-status">
              <span>{mixLabels[snapshot.phase]}</span>
              <progress
                max={7}
                value={snapshot.phase === 'ready' ? 7 : snapshot.age}
              />
            </output>
            <button
              className="bar-primary"
              disabled={busy}
              onClick={() => {
                api.current?.prepareCocktail(choice);
                setSnapshot(api.current?.barSnapshot() || initial);
              }}
            >
              {busy
                ? '正在调制…'
                : snapshot.phase === 'ready'
                  ? '再调一杯'
                  : '开始调酒'}
            </button>
            {snapshot.phase === 'ready' && (
              <p className="bar-note">
                {barDrinks[snapshot.drink].name}
                已经放在吧台。关上卡片，看看这一杯。
              </p>
            )}
          </>
        )}
        {selection === 'record' && (
          <>
            <div className="bar-records">
              {barRecords.map((record, i) => (
                <button
                  key={record.name}
                  aria-pressed={track === i}
                  onClick={() => (track === i ? stop() : void play(i))}
                >
                  <span
                    className={`bar-disc ${track === i ? 'spinning' : ''}`}
                    style={{ background: record.color }}
                  >
                    <Disc3 size={38} />
                  </span>
                  <span>
                    <strong>{record.name}</strong>
                    <small>{record.detail}</small>
                  </span>
                  {track === i ? <Square size={17} /> : <Play size={17} />}
                </button>
              ))}
            </div>
            <output className="bar-note">
              {error ||
                (track === null
                  ? '轻点唱片开始播放。'
                  : `正在播放：${barRecords[track].name}。返回房间后继续播放，离开酒吧后停止。`)}
            </output>
          </>
        )}
        {selection === 'fridge' && (
          <>
            <div className="bar-fridge-info">
              <Snowflake size={30} />
              <strong>
                {snapshot.fridgeOpen ? '柜门已经打开' : '饮料正在冷藏'}
              </strong>
              <span>苏打水 · 果汁 · 瓶装饮料</span>
            </div>
            <button
              className="bar-primary"
              onClick={() => {
                api.current?.interact('barFridge');
                setSnapshot(api.current?.barSnapshot() || initial);
              }}
            >
              {snapshot.fridgeOpen ? '关上冰箱' : '打开冰箱'}
            </button>
          </>
        )}
        {selection === 'darts' && (
          <>
            <div className="bar-score">
              <span>
                本局 <b>{dartTotal(hits)}</b>
              </span>
              <span>{hits.length} / 9 镖</span>
              <span>
                最佳 <b>{best}</b>
              </span>
            </div>
            <canvas
              ref={canvas}
              width={480}
              height={480}
              className="bar-dartboard"
              aria-hidden="true"
            />
            <output className="bar-throw-status">
              {finished
                ? `${dartTotal(hits) >= 180 ? '挑战成功' : '本局完成'} · ${dartTotal(hits)} 分`
                : hits.length
                  ? `上一镖：${hits.at(-1)!.label}`
                  : '红心 50 分 · 细圈为三倍与双倍区'}
            </output>
            <button
              className="bar-primary"
              onClick={finished ? restart : throwDart}
            >
              {finished ? <RotateCcw size={17} /> : <Crosshair size={17} />}{' '}
              {finished
                ? '再来一局'
                : phase === 'x'
                  ? '① 锁定左右'
                  : '② 投出这一镖'}
            </button>
            <p className="bar-note">
              可点击按钮，也可用空格键。
              {!saved ? '本次成绩暂未保存。' : '成绩保存在此浏览器。'}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
