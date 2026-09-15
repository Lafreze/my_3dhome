'use client';
import { useEffect } from 'react';
let record: ((kind: string, target?: string) => void) | undefined;
let room = 'study',
  mode = 'browse';
export function trackVisit(kind: 'room' | 'interact' | 'mode', target = '') {
  if (kind === 'room') room = target;
  if (kind === 'mode') mode = target;
  record?.(kind, target);
}
export default function VisitTracker() {
  useEffect(() => {
    const session = crypto.randomUUID();
    const inHouse =
      location.pathname === '/' || location.pathname === '/index.html';
    if (!inHouse) room = 'exhibit';
    let active = 0,
      seq = 0,
      last = performance.now(),
      wasVisible = !document.hidden;
    const sample = () => {
      const next = performance.now();
      if (wasVisible) active += Math.min(35, (next - last) / 1000);
      last = next;
      wasVisible = !document.hidden;
    };
    const send = (kind: string, target = '') => {
      sample();
      const body = JSON.stringify({
        session,
        seq: seq++,
        kind,
        target,
        room,
        mode,
        active,
      });
      if (kind === 'end' && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/visits',
          new Blob([body], { type: 'application/json' }),
        );
      } else
        void fetch('/api/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
    };
    record = send;
    send('start');
    if (inHouse) send('room', room);
    const timer = setInterval(() => {
      if (!document.hidden) send('heartbeat');
    }, 25000);
    const visibility = () => send(document.hidden ? 'end' : 'heartbeat');
    const end = () => send('end');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', end);
    return () => {
      end();
      record = undefined;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', end);
    };
  }, []);
  return null;
}
