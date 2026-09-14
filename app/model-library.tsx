'use client';
/* Full page links intentionally release the current WebGL context between these static routes. */
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
/* The orbit canvas is a keyboard-operated application; its labelled buttons provide equivalent controls. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Check,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Upload,
  Trash2,
  X,
} from 'lucide-react';
import { exhibits, type Exhibit } from './exhibit-data';
import { useStudio } from './studio-settings';
import ModelPreview from './model-preview';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function ModelLibrary() {
  const studio = useStudio(),
    fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Exhibit[]>(exhibits),
    [selected, setSelected] = useState(exhibits[0]),
    [query, setQuery] = useState(''),
    [message, setMessage] = useState(''),
    [manage, setManage] = useState(false),
    [passphrase, setPassphrase] = useState(''),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [visibility, setVisibility] = useState<'public' | 'private'>('private'),
    [compress, setCompress] = useState(true),
    [deleting, setDeleting] = useState<Exhibit | null>(null);
  useEffect(() => {
    let live = true;
    fetch(studio.admin ? '/api/admin/models' : '/api/models', {
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (live) {
          if (!studio.admin) setDeleting(null);
          setItems([...exhibits, ...data.items]);
          setSelected((current) =>
            current.visibility === 'private' && !studio.admin
              ? exhibits[0]
              : current,
          );
        }
      })
      .catch(() => {
        if (live) setMessage('暂时无法读取新增藏品，默认展品仍可浏览。');
      });
    return () => {
      live = false;
    };
  }, [studio.admin]);
  useEffect(() => {
    const update = () => {
      const id = location.hash.slice(1);
      const item = items.find((x) => x.id === id);
      if (item) setSelected(item);
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [items]);
  const select = (item: Exhibit) => {
    setSelected(item);
    location.assign('#' + item.id);
    if (innerWidth <= 700)
      document.querySelector('.model-library')?.scrollTo({
        top: 120,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  };
  const upload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const item = await studio.uploadModel(
        file,
        {
          title,
          description,
          visibility,
          compress,
        },
        setMessage,
      );
      setItems((current) => [...current, item]);
      select(item);
      setFile(null);
      setTitle('');
      setDescription('');
      if (fileInput.current) fileInput.current.value = '';
      const size = `${((item.originalBytes || item.bytes || 0) / 1048576).toFixed(2)} → ${((item.bytes || 0) / 1048576).toFixed(2)} MB`;
      const processing =
        item.compression === 'compressed'
          ? `已压缩 ${size}。`
          : item.compression === 'already-optimized'
            ? '模型已较精简，保留原文件。'
            : item.compression === 'fallback'
              ? '此模型未能进一步压缩，已保留原文件。'
              : '已按原文件保存。';
      setMessage(
        `${item.visibility === 'private' ? '已创建私密页面，未加入公开展柜。' : '已加入公开展柜。'}${processing}${item.storage === 'r2' ? '文件已保存到 R2。' : '文件已保存到本机。'}`,
      );
      setManage(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const login = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await studio.login(passphrase);
      setPassphrase('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法进入管理模式。');
    } finally {
      setBusy(false);
    }
  };
  const chooseFile = (value: File | undefined) => {
    if (!value) return;
    if (
      !value.name.toLowerCase().endsWith('.glb') ||
      value.size > 200 * 1024 * 1024
    ) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setMessage('请选择 200 MB 以内、包含贴图的 GLB 文件。');
      return;
    }
    setFile(value);
    if (!title) setTitle(value.name.replace(/\.glb$/i, '').slice(0, 80));
    setMessage('');
  };
  const shareAddress = (path: string) =>
    typeof window === 'undefined' ? path : new URL(path, location.origin).href;
  const copyShare = async () => {
    if (!selected.sharePath) return;
    try {
      await navigator.clipboard.writeText(shareAddress(selected.sharePath));
      setMessage('私密链接已复制。');
    } catch {
      setMessage('可选中上方地址，手动复制链接。');
    }
  };
  const resetShare = async () => {
    setBusy(true);
    try {
      const item = await studio.resetModelShare(selected.id);
      setItems((current) => current.map((x) => (x.id === item.id ? item : x)));
      setSelected(item);
      setMessage('已生成新链接，旧链接立即失效。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更换失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const visible = items.filter((item) =>
    `${item.title} ${item.description} ${item.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const remove = async () => {
    if (!deleting || !studio.admin || busy) return;
    setBusy(true);
    try {
      const result = await studio.deleteModel(deleting.id);
      setItems((current) => current.filter((item) => item.id !== deleting.id));
      if (selected.id === deleting.id) select(exhibits[0]);
      setDeleting(null);
      setMessage(
        result.cleanupPending
          ? '模型已移除，存储文件正在清理。'
          : '模型已删除。',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="model-library">
      <header className="archive-header">
        <a className="archive-back" href="/?room=gallery">
          <ArrowLeft size={17} />
          <span>返回展示区</span>
        </a>
        <a className="archive-brand" href="/">
          SATORI<small>OBJECT ARCHIVE</small>
        </a>
        <button
          className="archive-manage"
          aria-label={studio.admin ? '添加藏品' : '管理藏品'}
          onClick={() => setManage((v) => !v)}
        >
          <Plus size={16} />
          <span>{studio.admin ? '添加藏品' : '管理藏品'}</span>
        </button>
      </header>
      <div className="archive-title">
        <div>
          <p>THE COLLECTION / 01</p>
          <h1>
            三维藏品室<span>Objects, up close.</span>
          </h1>
        </div>
      </div>
      {message && (
        <output className="archive-notice">
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage('')}>
            <X size={15} />
          </button>
        </output>
      )}
      <div className="archive-layout">
        <div>
          <ModelPreview
            item={selected}
            paused={manage || (!!deleting && studio.admin)}
            position={`${String(items.findIndex((i) => i.id === selected.id) + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`}
          />
          {studio.admin &&
            !exhibits.some((item) => item.id === selected.id) && (
              <div className="archive-delete-row">
                <button
                  disabled={busy}
                  onClick={() => {
                    setMessage('');
                    setDeleting(selected);
                  }}
                >
                  <Trash2 size={15} /> 删除模型
                </button>
              </div>
            )}
          {studio.admin && selected.sharePath && (
            <section className="archive-share-panel" aria-label="私密分享链接">
              <div>
                <LockKeyhole size={18} />
                <strong>私密分享</strong>
              </div>
              <label>
                独立页面地址
                <input
                  readOnly
                  aria-label="独立页面地址"
                  value={shareAddress(selected.sharePath)}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <div className="archive-share-actions">
                <a href={selected.sharePath} target="_blank" rel="noreferrer">
                  打开独立页面 <ArrowUpRight size={14} />
                </a>
                <button onClick={() => void copyShare()}>复制链接</button>
                <button disabled={busy} onClick={() => void resetShare()}>
                  更换链接（旧链接失效）
                </button>
              </div>
            </section>
          )}
        </div>
        <aside className="archive-shelf" aria-label="藏品列表">
          <div className="archive-shelf-heading">
            <h2>{studio.admin ? '全部藏品 · 管理视图' : '展柜藏品'}</h2>
            <span>{items.length} 件</span>
          </div>
          <label className="archive-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="寻找一件藏品"
              aria-label="搜索藏品"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="archive-items">
            {visible.map((item, index) => (
              <button
                key={item.id}
                className={`archive-item${selected.id === item.id ? ' selected' : ''}`}
                aria-pressed={selected.id === item.id}
                onClick={() => select(item)}
              >
                <div
                  className="archive-thumbnail"
                  style={
                    {
                      '--exhibit-accent': item.accent || '#b6b6a5',
                    } as React.CSSProperties
                  }
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <Box size={36} />
                  )}
                  <small>{String(index + 1).padStart(2, '0')}</small>
                </div>
                <div className="archive-item-title">
                  <div>
                    <small>{item.category}</small>
                    <h3>{item.title}</h3>
                  </div>
                  {selected.id === item.id ? (
                    <Check size={17} />
                  ) : (
                    <ArrowUpRight size={17} />
                  )}
                </div>
              </button>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="archive-empty">没有找到这件藏品，换个名字试试。</p>
          )}
          <button className="archive-add" onClick={() => setManage(true)}>
            <Plus size={20} />
            <span>
              <strong>添加模型</strong>
            </span>
            <ArrowUpRight size={17} />
          </button>
        </aside>
      </div>
      <footer className="archive-footer">
        <span>SATORI / OBJECT ARCHIVE</span>
      </footer>
      <Dialog
        open={!!deleting && studio.admin}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent
          className="archive-upload archive-delete-dialog"
          overlayClassName="archive-overlay"
          showCloseButton={!busy}
        >
          <DialogTitle>删除「{deleting?.title}」？</DialogTitle>
          <DialogDescription>
            文件及其分享页面将被删除，无法恢复。
          </DialogDescription>
          <div className="archive-delete-actions">
            <button disabled={busy} onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              className="archive-delete-confirm"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? '正在删除…' : '确认删除'}
            </button>
          </div>
          {message && (
            <output className="archive-upload-message" aria-live="polite">
              {message}
            </output>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={manage}
        onOpenChange={(value) => {
          if (!busy) setManage(value);
        }}
      >
        <DialogContent
          className="archive-upload"
          overlayClassName="archive-overlay"
          showCloseButton={false}
        >
          <button
            className="archive-upload-close"
            aria-label="关闭藏品管理"
            disabled={busy}
            onClick={() => setManage(false)}
          >
            <X size={19} />
          </button>
          <small>YOUR PERSONAL COLLECTION</small>
          <DialogTitle>{studio.admin ? '添加模型' : '管理藏品'}</DialogTitle>
          <DialogDescription className="sr-only">
            为小屋展柜添加模型和说明。
          </DialogDescription>
          {studio.admin ? (
            <form onSubmit={upload}>
              <label className="archive-file">
                <Upload size={27} />
                <strong>{file ? file.name : '选择一个 3D 模型'}</strong>
                <span>
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : 'GLB · 包含贴图 · 最大 200 MB'}
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".glb,model/gltf-binary"
                  aria-label="选择 GLB 模型"
                  disabled={busy}
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                />
              </label>
              <label>
                藏品名称
                <input
                  value={title}
                  required
                  maxLength={80}
                  disabled={busy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                简单说明
                <textarea
                  value={description}
                  maxLength={600}
                  rows={3}
                  disabled={busy}
                  placeholder="它的造型、灵感，或你想留下的一句话。"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <fieldset className="archive-visibility" disabled={busy}>
                <legend>谁可以看到这件模型</legend>
                <label aria-label="私密分享">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                  />
                  <span>
                    <strong>私密分享</strong>
                  </span>
                </label>
                <label aria-label="公开展示">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                  />
                  <span>
                    <strong>公开展示</strong>
                    <small>加入展柜 · 所有访客可见</small>
                  </span>
                </label>
              </fieldset>
              <label className="archive-compress" aria-label="智能压缩（推荐）">
                <input
                  type="checkbox"
                  checked={compress}
                  disabled={busy}
                  onChange={(e) => setCompress(e.target.checked)}
                />
                <span>
                  <strong>智能压缩（推荐）</strong>
                  <small>不减面，贴图最高 2K；若没有变小则保留原文件。</small>
                </span>
              </label>
              <button
                className="archive-submit"
                disabled={!file || busy || !title.trim()}
              >
                {busy ? (
                  <LoaderCircle className="archive-spinner" size={17} />
                ) : (
                  <Plus size={17} />
                )}
                <span>
                  {busy
                    ? '正在上传、处理并保存…'
                    : visibility === 'private'
                      ? '创建私密页面'
                      : '存入公开展柜'}
                </span>
              </button>
            </form>
          ) : (
            <form onSubmit={login}>
              <label>
                管理暗号
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passphrase}
                  disabled={busy}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </label>
              <button className="archive-submit" disabled={busy}>
                <LockKeyhole size={16} />
                {busy ? '正在验证…' : '进入管理模式'}
              </button>
            </form>
          )}
          {message && (
            <output className="archive-upload-message" aria-live="polite">
              {message}
            </output>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
