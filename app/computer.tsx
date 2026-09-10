'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, Save, X, ArrowUpRight } from 'lucide-react';
import { websiteURL } from './device-settings';
import { useStudio } from './studio-settings';
export default function Computer({
  active,
  open,
  onClose,
  onScreen,
  onPower,
  onManage,
}: {
  active: boolean;
  open: boolean;
  onClose: () => void;
  onScreen: (element: HTMLElement | null) => void;
  onPower: (on: boolean) => void;
  onManage: () => void;
}) {
  const studio = useStudio();
  const stored = studio.settings.devices.computer;
  const [url, setUrl] = useState(''),
    [source, setSource] = useState(''),
    [enabled, setEnabled] = useState(true),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const close = useRef<HTMLButtonElement>(null);
  const [host] = useState(() => {
    const el = document.createElement('div');
    el.className = 'tv-native-screen computer-native-screen';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    return el;
  });
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) {
        setEnabled(stored.enabled);
        setSource(stored.url);
        setUrl(stored.url);
        setLoaded(studio.ready);
      }
    });
    return () => {
      live = false;
    };
  }, [stored.url, stored.enabled, studio.ready]);
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
  const save = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage('');
    const input = url.trim();
    const valid = input ? websiteURL(input) : '';
    try {
      if (!studio.admin && valid === null && input.length <= 256) {
        // Never navigate, store, echo or send this value to an embedded website.
        setUrl(source);
        try {
          await studio.login(input);
          onManage();
        } catch {
          setMessage('请输入完整的 HTTP / HTTPS 网址。');
        }
        return;
      }
      if (valid === null) {
        setMessage('请输入完整的 HTTP / HTTPS 网址。');
        return;
      }
      if (!studio.admin) {
        setSource(valid);
        setEnabled(true);
        setMessage('本次访问预览');
        return;
      }
      await studio.save({
        devices: { computer: { url: valid, enabled: true } },
      });
      setSource(valid);
      setEnabled(true);
      setMessage('已保存 · 所有访客进入书房均可观看');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const toggle = async () => {
    const next = !enabled;
    try {
      if (studio.admin)
        await studio.save({
          devices: { computer: { url: source, enabled: next } },
        });
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
            sandbox="allow-scripts allow-forms allow-popups"
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
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={2048}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            className="tv-play"
            disabled={busy}
            aria-label={studio.admin ? '保存电脑网址' : '打开电脑网址'}
          >
            {studio.admin ? <Save size={16} /> : <ArrowUpRight size={16} />}
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
