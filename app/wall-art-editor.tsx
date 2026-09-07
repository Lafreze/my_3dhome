'use client';
/* oxlint-disable next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { X, Upload, RotateCcw } from 'lucide-react';
import { wallArt, type WallArtId } from './wall-art-data';
import { compressArt, readArt, writeArt } from './art-storage';
export default function WallArtEditor({
  selected,
  open,
  onClose,
  onChange,
  onFrame,
}: {
  selected: string | null;
  open: boolean;
  onClose: () => void;
  onFrame: (id: WallArtId) => void;
  onChange: (pictures: Record<string, string>) => void;
}) {
  const [id, setId] = useState<WallArtId>('galleryArt1'),
    [pictures, setPictures] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const urls = useRef<Record<string, string>>({}),
    input = useRef<HTMLInputElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let live = true;
    const ownedURLs = urls.current;
    readArt()
      .then((stored) => {
        if (!live) return;
        for (const [key, blob] of Object.entries(stored))
          urls.current[key] = URL.createObjectURL(blob);
        setPictures({ ...urls.current });
      })
      .catch(() => {
        if (live) setMessage('无法读取图片存储。');
      });
    return () => {
      live = false;
      Object.values(ownedURLs).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => onChange(pictures), [pictures, onChange]);
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (wallArt.some((a) => a.id === selected)) setId(selected as WallArtId);
      setMessage('');
    });
    close.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [selected, open, onClose]);
  const update = async (file: File | undefined) => {
    if (!file) return;
    const target = id;
    setBusy(true);
    setMessage('正在压缩…');
    try {
      const blob = await compressArt(file);
      await writeArt(target, blob);
      if (urls.current[target]) URL.revokeObjectURL(urls.current[target]);
      urls.current[target] = URL.createObjectURL(blob);
      setPictures({ ...urls.current });
      setMessage(
        `已保存 · ${Math.round(file.size / 1024)} → ${Math.round(blob.size / 1024)} KB`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片保存失败。');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await writeArt(id, null);
      if (urls.current[id]) URL.revokeObjectURL(urls.current[id]);
      delete urls.current[id];
      setPictures({ ...urls.current });
      setMessage('已恢复原作');
    } catch {
      setMessage('恢复失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="tv-remote wall-art-editor"
      hidden={!open}
      aria-label="画作设置"
    >
      <div className="tv-remote-heading">
        <span>墙上画作</span>
        <button ref={close} aria-label="收起画作设置" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <label className="art-select">
        选择画框
        <select
          aria-label="选择画框"
          value={id}
          disabled={busy}
          onChange={(e) => {
            setId(e.target.value as WallArtId);
            onFrame(e.target.value as WallArtId);
            setMessage('');
          }}
        >
          {wallArt.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <div className="art-preview">
        {pictures[id] ? (
          <img src={pictures[id]} alt="当前画框图片" />
        ) : (
          <span>原创画作</span>
        )}
      </div>
      <div className="tv-toolbar">
        <button disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={14} />
          上传图片
        </button>
        <button disabled={busy || !pictures[id]} onClick={() => void reset()}>
          <RotateCcw size={14} />
          恢复原作
        </button>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="上传画作图片"
        onChange={(e) => {
          void update(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {message && <output className="device-saved">{message}</output>}
      <p className="device-note">自动压缩，完整展示。保存在当前浏览器。</p>
    </section>
  );
}
