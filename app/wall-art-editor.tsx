'use client';
/* oxlint-disable next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { X, Upload, RotateCcw } from 'lucide-react';
import { wallArt, type WallArtId } from './wall-art-data';
import { compressArt } from './art-storage';
import { useStudio } from './studio-settings';
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
  const studio = useStudio();
  const pictures = studio.settings.wallArt;
  const [id, setId] = useState<WallArtId>('galleryArt1'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null),
    close = useRef<HTMLButtonElement>(null);
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
    if (!file || !studio.admin) return;
    const target = id;
    setBusy(true);
    setMessage('正在压缩…');
    try {
      const blob = await compressArt(file);
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(Error('图片读取失败。'));
        reader.onerror = () => reject(Error('图片读取失败。'));
        reader.readAsDataURL(blob);
      });
      await studio.save({ wallArt: { [target]: data } });
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
    if (!studio.admin) return;
    setBusy(true);
    try {
      await studio.save({ wallArt: { [id]: null } });
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
      {studio.admin && (
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
      )}
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
      <p className="device-note">画作由管理者布置，所有访客均可观看。</p>
    </section>
  );
}
