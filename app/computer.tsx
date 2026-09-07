'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, Save, X, ArrowUpRight } from 'lucide-react';
import {
  computerSettingsKey,
  readDevice,
  saveDevice,
  websiteURL,
} from './device-settings';
export default function Computer({
  active,
  open,
  onClose,
  onScreen,
  onPower,
}: {
  active: boolean;
  open: boolean;
  onClose: () => void;
  onScreen: (element: HTMLElement | null) => void;
  onPower: (on: boolean) => void;
}) {
  const [url, setUrl] = useState(''),
    [source, setSource] = useState(''),
    [enabled, setEnabled] = useState(true),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState('');
  const close = useRef<HTMLButtonElement>(null);
  const [host] = useState(() => {
    const el = document.createElement('div');
    el.className = 'tv-native-screen computer-native-screen';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    return el;
  });
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const stored = readDevice(computerSettingsKey);
      if (stored) {
        setEnabled(stored.enabled);
        const valid = websiteURL(stored.url);
        if (valid) {
          setUrl(valid);
          setSource(valid);
          setEnabled(stored.enabled);
        }
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const running = loaded && active && enabled;
  useEffect(() => {
    onPower(running);
    onScreen(running && source ? host : null);
    return () => onScreen(null);
  }, [running, source, host, onPower, onScreen]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, onClose]);
  const save = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid = websiteURL(url);
    if (!valid) {
      setMessage('请输入完整的 HTTP / HTTPS 网址。');
      return;
    }
    try {
      saveDevice(computerSettingsKey, valid, true);
      setSource(valid);
      setEnabled(true);
      setMessage('已保存 · 进入书房自动显示');
    } catch {
      setMessage('浏览器无法保存网址。');
    }
  };
  const toggle = () => {
    const next = !enabled;
    try {
      saveDevice(computerSettingsKey, source, next);
      setEnabled(next);
    } catch {
      setMessage('电源状态无法保存。');
    }
  };
  return (
    <>
      {createPortal(
        running && source ? (
          <iframe
            key={source}
            src={source}
            title="工作站网页"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allow="fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null,
        host,
      )}
      <section className="tv-remote" hidden={!open} aria-label="电脑设置">
        <div className="tv-remote-heading">
          <span>工作站</span>
          <button
            ref={close}
            type="button"
            aria-label="收起电脑设置"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <form className="tv-source-form" onSubmit={save}>
          <input
            aria-label="电脑网址"
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="tv-play" aria-label="保存电脑网址">
            <Save size={16} />
          </button>
        </form>
        {message && <output className="device-saved">{message}</output>}
        <div className="tv-toolbar">
          {source && (
            <a href={source} target="_blank" rel="noreferrer">
              独立打开
              <ArrowUpRight size={13} />
            </a>
          )}
          <button
            className="tv-power"
            type="button"
            aria-label={enabled ? '关闭电脑' : '打开电脑'}
            aria-pressed={enabled}
            onClick={toggle}
          >
            <Power size={15} />
          </button>
        </div>
        <p className="device-note">部分网站限制嵌入，若未显示可独立打开。</p>
      </section>
    </>
  );
}
