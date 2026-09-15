'use client';
import { useEffect, useRef, useState } from 'react';
import type { RoomApi } from './room-data';
import type { RoamTarget } from './roam-scene';
export default function RoamControls({
  api,
  blocked,
  target,
}: {
  api: React.RefObject<RoomApi | null>;
  blocked: boolean;
  target: RoamTarget | null;
}) {
  const [stick, setStick] = useState<[number, number]>([0, 0]);
  const pointer = useRef<number | null>(null);
  const base = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    const keys = new Set<string>();
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest(
        'input,textarea,select,[contenteditable="true"],[role="dialog"]',
      );
    const move = () =>
      api.current?.setRoamInput(
        Number(keys.has('ArrowRight') || keys.has('KeyD')) -
          Number(keys.has('ArrowLeft') || keys.has('KeyA')),
        Number(keys.has('ArrowDown') || keys.has('KeyS')) -
          Number(keys.has('ArrowUp') || keys.has('KeyW')),
      );
    const stop = () => {
      keys.clear();
      pointer.current = null;
      setStick([0, 0]);
      api.current?.setRoamInput(0, 0);
    };
    const down = (e: KeyboardEvent) => {
      if (blocked || editable(e.target) || e.altKey || e.ctrlKey || e.metaKey)
        return;
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
        ].includes(e.code)
      ) {
        e.preventDefault();
        keys.add(e.code);
        move();
      }
      if (
        e.code === 'Space' &&
        e.target instanceof HTMLElement &&
        e.target.closest('button,a')
      )
        return;
      if (['KeyE', 'Space'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) api.current?.roamInteract();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (keys.delete(e.code)) {
        e.preventDefault();
        move();
      }
    };
    const hide = () => {
      if (document.hidden) stop();
    };
    stop();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hide);
    return () => {
      stop();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [api, blocked]);
  const update = (e: React.PointerEvent<HTMLFieldSetElement>) => {
    if (blocked || pointer.current !== e.pointerId || !base.current) return;
    const rect = base.current.getBoundingClientRect(),
      radius = rect.width * 0.3;
    let x = (e.clientX - rect.left - rect.width / 2) / radius,
      y = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length < 0.13) x = y = 0;
    else {
      x /= Math.max(1, length);
      y /= Math.max(1, length);
    }
    setStick([x * radius, y * radius]);
    api.current?.setRoamInput(x, y);
  };
  const release = (e: React.PointerEvent<HTMLFieldSetElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setStick([0, 0]);
    api.current?.setRoamInput(0, 0);
  };
  return (
    <div
      className={`roam-controls${blocked ? ' is-blocked' : ''}`}
      aria-label="漫游操作"
    >
      <div className="roam-keyboard-hint">
        <kbd>W A S D</kbd> / 方向键行走 <span>·</span> <kbd>E</kbd> / 空格互动
      </div>
      <fieldset
        ref={base}
        className="roam-joystick"
        aria-label="移动摇杆"
        onPointerDown={(e) => {
          if (blocked || pointer.current !== null) return;
          e.preventDefault();
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={update}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span className="stick-direction north">⌃</span>
        <span className="stick-direction east">›</span>
        <span className="stick-direction south">⌄</span>
        <span className="stick-direction west">‹</span>
        <i style={{ transform: `translate(${stick[0]}px, ${stick[1]}px)` }} />
      </fieldset>
      <div className="roam-context">
        <span>
          {blocked
            ? '关闭面板，继续散步'
            : target?.label || '慢慢走，看看身边的小事'}
        </span>
        <button
          className="roam-interact"
          disabled={blocked || !target}
          aria-label={target ? `互动：${target.label}` : '靠近物品后互动'}
          onClick={() => api.current?.roamInteract()}
        >
          <b>✦</b>
          <small>互动</small>
        </button>
      </div>
    </div>
  );
}
