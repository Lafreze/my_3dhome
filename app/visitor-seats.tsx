'use client';
// The selection bridge intentionally reads the latest render, including its async submit.
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState } from 'react';
import {
  BedDouble,
  Check,
  Heart,
  LoaderCircle,
  LogOut,
  LocateFixed,
  Pencil,
  Smile,
  Sun,
  Moon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { rooms, type HouseView } from './house-data';
import { seats, seatById, type Presence } from './seat-data';
import type { RoomApi } from './room-data';
import VisitorWardrobe from './visitor-wardrobe';
import {
  appearanceStorageKey,
  defaultAppearance,
  appearanceOptions,
  readAppearance,
} from './visitor-appearance';

export default function VisitorSeats({
  api,
  ready,
  open,
  selected,
  view,
  onClose,
  onChoose,
  onCount,
  selection,
  onNotice,
}: {
  api: React.RefObject<RoomApi | null>;
  ready: boolean;
  open: boolean;
  selected: string | null;
  view: HouseView;
  onClose: () => void;
  onChoose: (id: string) => void;
  onCount: (n: number) => void;
  selection: React.RefObject<((id: string) => void) | null>;
  onNotice: (text: string) => void;
}) {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [appearance, setAppearance] = useState({ ...defaultAppearance });
  const [connected, setConnected] = useState(false);
  const snapshot = useRef<Presence | null>(null),
    request = useRef(0),
    mounted = useRef(true);
  const mutating = useRef(false);
  const mine = presence?.visitors.find((p) => p.id === presence.me);
  const seat = selected ? seatById.get(selected) : null;
  const occupant = presence?.visitors.find((p) => p.seatId === selected);
  const occupiedByOther = !!occupant && occupant.id !== presence?.me;
  function accept(next: Presence, seq: number) {
    if (!mounted.current || seq < request.current) return;
    const offset = next.serverTime ? Date.now() - next.serverTime : 0;
    next = {
      ...next,
      visitors: next.visitors.map((v) => ({
        ...v,
        ...(v.gesture
          ? {
              gesture: {
                ...v.gesture,
                at: v.gesture.at + offset,
                expiresAt: v.gesture.expiresAt + offset,
              },
            }
          : {}),
      })),
    };
    snapshot.current = next;
    setPresence(next);
    setConnected(true);
  }
  useEffect(() => {
    mounted.current = true;
    if (!ready) return;
    let stopped = false,
      polling = false;
    const controllers = new Set<AbortController>();
    async function refresh(heartbeat = false) {
      if (stopped || polling || mutating.current) return;
      polling = true;
      const controller = new AbortController();
      controllers.add(controller);
      const seq = ++request.current;
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch('/api/presence', {
          method: heartbeat ? 'POST' : 'GET',
          ...(heartbeat
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'heartbeat' }),
              }
            : {}),
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('连接中断');
        const next = (await response.json()) as Presence;
        if (!stopped) accept(next, seq);
      } catch {
        if (!stopped && seq === request.current) setConnected(false);
      } finally {
        clearTimeout(timeout);
        controllers.delete(controller);
        polling = false;
      }
    }
    void refresh(true);
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 4000);
    const heartbeat = setInterval(() => {
      void refresh(true);
    }, 25000);
    const wake = () => {
      if (!document.hidden) void refresh(true);
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      mounted.current = false;
      clearInterval(poll);
      clearInterval(heartbeat);
      controllers.forEach((c) => c.abort());
      document.removeEventListener('visibilitychange', wake);
    };
  }, [ready]);
  useEffect(() => {
    if (presence && ready) {
      api.current?.setVisitors(presence.visitors, presence.me);
      onCount(presence.visitors.length);
    }
  }, [presence, ready, api, onCount]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let saved = '',
        savedAppearance: unknown = null;
      try {
        saved = localStorage.getItem('satori-visitor-name') || '';
        savedAppearance = JSON.parse(
          localStorage.getItem(appearanceStorageKey) || 'null',
        );
      } catch {
        /* Storage is optional. */
      }
      const own = snapshot.current?.visitors.find(
        (p) => p.id === snapshot.current?.me,
      );
      setName(own?.name || saved || appearanceOptions.characters[0].label);
      setAppearance(readAppearance(own?.appearance || savedAppearance));
      setError('');
      if (!selected && own) api.current?.focusSeat(own.seatId);
    });
    return () => {
      active = false;
    };
  }, [open, selected, api]);
  // Scene selection never opens the wardrobe for a returning visitor changing seats.
  useEffect(() => {
    selection.current = (id) => {
      const live = snapshot.current;
      if (!live || !connected) {
        onNotice('正在连接小屋，请稍候再入座。');
        return;
      }
      if (mutating.current) return;
      const own = live.visitors.find((v) => v.id === live.me);
      const taken = live.visitors.find((v) => v.seatId === id);
      let savedName = '',
        savedLook: unknown = null;
      try {
        savedName = localStorage.getItem('satori-visitor-name') || '';
        savedLook = JSON.parse(
          localStorage.getItem(appearanceStorageKey) || 'null',
        );
      } catch {
        /* Seating still works without storage. */
      }
      if (taken || (!own && !savedName)) {
        onChoose(id);
        return;
      }
      const target = seatById.get(id);
      if (!target) return;
      void submit(
        target.kind === 'bed' ? 'rest' : 'sit',
        undefined,
        undefined,
        {
          seatId: id,
          name: own?.name || savedName,
          appearance: readAppearance(own?.appearance || savedLook),
        },
      );
    };
    return () => {
      selection.current = null;
    };
  });
  async function submit(
    action: 'sit' | 'rest' | 'wake' | 'leave' | 'gesture',
    kind?: 'hello' | 'heart',
    targetId?: string,
    placement?: { seatId: string; name: string; appearance: typeof appearance },
  ) {
    if (mutating.current) return;
    mutating.current = true;
    setBusy(true);
    setError('');
    ++request.current;
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          seatId: placement?.seatId || selected,
          name: placement?.name || name,
          ...(['sit', 'rest'].includes(action)
            ? { appearance: placement?.appearance || appearance }
            : {}),
          ...(action === 'gesture'
            ? { kind, ...(targetId ? { targetId } : {}) }
            : {}),
        }),
        signal: controller.signal,
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || '操作没有完成，请重试');
      accept(next, ++request.current);
      const own = (next as Presence).visitors.find((v) => v.id === next.me);
      if (action === 'sit' || action === 'rest')
        try {
          localStorage.setItem('satori-visitor-name', own?.name || name.trim());
          localStorage.setItem(
            appearanceStorageKey,
            JSON.stringify(own?.appearance || appearance),
          );
        } catch {
          /* Optional saved preferences. */
        }
      onClose();
      if (action !== 'leave' && own)
        requestAnimationFrame(() => api.current?.focusSeat(own.seatId));
    } catch (e) {
      if (placement)
        onNotice(e instanceof Error ? e.message : '入座失败，请重试。');
      if (mounted.current)
        setError(
          e instanceof Error && e.name !== 'AbortError'
            ? e.message
            : '连接超时，请重试',
        );
    } finally {
      mutating.current = false;
      clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }
  const resting = mine?.posture === 'rest';
  const bed = seat?.kind === 'bed';
  const others = presence?.visitors.filter((v) => v.id !== presence.me) || [];
  const recommended = seats.find(
    (s) =>
      s.room === view && !presence?.visitors.some((v) => v.seatId === s.id),
  );
  const location = (id: string) => {
    api.current?.focusSeat(id);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent
        className={`visitor-dialog${seat && !occupiedByOther ? ' visitor-dialog-atelier' : ''}`}
        aria-busy={busy}
      >
        <div className="visitor-mark">
          {bed ? <BedDouble size={22} /> : <LocateFixed size={22} />}
        </div>
        <DialogTitle>
          {seat ? (occupiedByOther ? occupant?.name : seat.name) : '此刻在这里'}
        </DialogTitle>
        <DialogDescription>
          {seat
            ? `${rooms[seat.room].name} · ${occupant ? (occupant.posture === 'rest' ? '正在休息' : occupant.id === presence?.me ? '你在这里' : seat.name) : '空闲'}`
            : mine
              ? '找到自己，也看看朋友在哪里'
              : '给自己找个舒服的位置'}
        </DialogDescription>
        {!connected && (
          <output className="visitor-notice">正在连接工作室…</output>
        )}
        {seat && !occupiedByOther && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(bed ? 'rest' : 'sit');
            }}
          >
            <VisitorWardrobe
              appearance={appearance}
              onChange={setAppearance}
              disabled={busy}
              posture={bed ? 'rest' : 'sit'}
            >
              <label className="visitor-name">
                昵称
                <input
                  autoComplete="off"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="怎么称呼你？"
                  disabled={busy}
                />
              </label>
            </VisitorWardrobe>
            <button
              className="visitor-primary"
              type="submit"
              disabled={
                !connected ||
                busy ||
                !name.trim() ||
                Array.from(name.trim()).length > 16
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : bed ? (
                <Moon size={16} />
              ) : (
                <Check size={16} />
              )}
              {bed
                ? occupant?.posture === 'rest'
                  ? '保存'
                  : '躺下休息'
                : occupant
                  ? '保存'
                  : mine
                    ? '换到这里'
                    : '坐在这里'}
            </button>
          </form>
        )}
        {bed && !occupiedByOther && (
          <div className="visitor-actions">
            <button onClick={() => api.current?.interact('bedsideLamp')}>
              <Moon size={16} />
              床头灯
            </button>
          </div>
        )}
        {occupiedByOther &&
          (occupant?.posture === 'rest' ? (
            <p className="visitor-notice">正在安静休息，稍后再打招呼吧。</p>
          ) : (
            <VisitorActions
              disabled={busy || !connected || !mine || !!resting}
              onHello={() => void submit('gesture', 'hello', occupant?.id)}
              onHeart={() => void submit('gesture', 'heart', occupant?.id)}
            />
          ))}
        {!seat && (
          <div className="visitor-people">
            {mine ? (
              <section className="visitor-self">
                <button
                  className="visitor-person"
                  onClick={() => location(mine.seatId)}
                >
                  <LocateFixed size={19} />
                  <span>
                    <strong>{mine.name} · 我</strong>
                    <small>
                      {rooms[seatById.get(mine.seatId)!.room].name} ·{' '}
                      {resting ? '休息中' : seatById.get(mine.seatId)!.name}
                    </small>
                  </span>
                  <span className="visitor-locate-label">定位</span>
                </button>
                <button
                  className="visitor-edit"
                  aria-label="编辑我的角色"
                  onClick={() => onChoose(mine.seatId)}
                >
                  <Pencil size={14} />
                </button>
              </section>
            ) : (
              <div className="visitor-empty">
                <p>点击场景中的空椅或床，放置你的角色。</p>
                {recommended && (
                  <button
                    className="visitor-primary"
                    onClick={() => selection.current?.(recommended.id)}
                  >
                    在这里放置角色
                  </button>
                )}
              </div>
            )}
            {others.length > 0 && (
              <section className="visitor-others">
                <h3>在线访客 · {others.length}</h3>
                {others.map((person) => (
                  <div className="visitor-other" key={person.id}>
                    <button
                      className="visitor-person"
                      onClick={() => location(person.seatId)}
                    >
                      <span className="visitor-initial">
                        {person.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{person.name}</strong>
                        <small>
                          {rooms[seatById.get(person.seatId)!.room].name} ·{' '}
                          {person.posture === 'rest' ? '休息中' : '在这里'}
                        </small>
                      </span>
                      <LocateFixed size={15} />
                    </button>
                    <button
                      className="visitor-greet"
                      aria-label={`与 ${person.name} 互动`}
                      onClick={() => onChoose(person.seatId)}
                    >
                      <Smile size={16} />
                    </button>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
        {mine && resting && (!seat || occupant?.id === mine.id) && (
          <button
            className="visitor-primary"
            disabled={busy || !connected}
            onClick={() => void submit('wake')}
          >
            <Sun size={16} />
            醒来，坐一会儿
          </button>
        )}
        {mine && !resting && (!seat || occupant?.id === mine.id) && (
          <VisitorActions
            disabled={busy || !connected}
            onHello={() => void submit('gesture', 'hello')}
            onHeart={() => void submit('gesture', 'heart')}
          />
        )}
        {error && (
          <p className="visitor-error" role="alert">
            {error}
          </p>
        )}
        {seat && (
          <button
            className="visitor-secondary"
            onClick={() => onChoose('')}
            disabled={busy}
          >
            查看在线角色
          </button>
        )}
        {mine && (
          <button
            className="visitor-leave"
            disabled={busy || !connected}
            onClick={() => void submit('leave')}
          >
            <LogOut size={14} />
            收起我的角色
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VisitorActions({
  disabled,
  onHello,
  onHeart,
}: {
  disabled: boolean;
  onHello: () => void;
  onHeart: () => void;
}) {
  return (
    <div className="visitor-actions">
      <button disabled={disabled} onClick={onHello}>
        <Smile size={16} />
        点头致意
      </button>
      <button disabled={disabled} onClick={onHeart}>
        <Heart size={16} />
        送个心意
      </button>
    </div>
  );
}
