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
  ChevronLeft,
  ChevronRight,
  Expand,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { exhibits, type Exhibit } from './exhibit-data';
import { useStudio } from './studio-settings';
import type { ModelViewer } from './model-viewer-scene';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function ModelLibrary() {
  const studio = useStudio(),
    host = useRef<HTMLDivElement>(null),
    viewer = useRef<ModelViewer | null>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Exhibit[]>(exhibits),
    [selected, setSelected] = useState(exhibits[0]),
    [status, setStatus] = useState({ loading: true, error: '' }),
    [engineReady, setEngineReady] = useState(false),
    [engineRetry, setEngineRetry] = useState(0),
    [auto, setAuto] = useState(false),
    [query, setQuery] = useState(''),
    [message, setMessage] = useState(''),
    [manage, setManage] = useState(false),
    [passphrase, setPassphrase] = useState(''),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState('');
  useEffect(() => {
    let live = true;
    fetch('/api/models', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (live) setItems([...exhibits, ...data.items]);
      })
      .catch(() => {
        if (live) setMessage('暂时无法读取新增藏品，默认展品仍可浏览。');
      });
    return () => {
      live = false;
    };
  }, []);
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
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) setEngineReady(false);
    });
    import('./model-viewer-scene')
      .then(({ createModelViewer }) => {
        if (!live || !host.current) return;
        try {
          viewer.current = createModelViewer(host.current, setStatus);
          setEngineReady(true);
        } catch {
          setStatus({
            loading: false,
            error: '当前浏览器无法打开三维画面，请开启硬件加速后重试。',
          });
        }
      })
      .catch(() =>
        setStatus({ loading: false, error: '查看器暂时无法载入，请重试。' }),
      );
    return () => {
      live = false;
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [engineRetry]);
  useEffect(() => {
    if (engineReady) void viewer.current?.select(selected);
  }, [selected, engineReady]);
  useEffect(
    () => viewer.current?.auto(auto && !manage),
    [auto, manage, engineReady],
  );
  const select = (item: Exhibit) => {
    setSelected(item);
    location.assign('#' + item.id);
    setAuto(false);
    if (innerWidth <= 700)
      host.current
        ?.closest('.model-library')
        ?.scrollTo({
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
      const item = await studio.uploadModel(file, { title, description });
      setItems((current) => [...current, item]);
      select(item);
      setFile(null);
      setTitle('');
      setDescription('');
      if (fileInput.current) fileInput.current.value = '';
      setMessage('已存入展柜，访客现在可以浏览这件模型。');
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
      value.size > 80 * 1024 * 1024
    ) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setMessage('请选择 80 MB 以内、包含贴图的 GLB 文件。');
      return;
    }
    setFile(value);
    if (!title) setTitle(value.name.replace(/\.glb$/i, '').slice(0, 80));
    setMessage('');
  };
  const visible = items.filter((item) =>
    `${item.title} ${item.description} ${item.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
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
        <button className="archive-manage" onClick={() => setManage((v) => !v)}>
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
        <p className="archive-intro">
          把喜欢的造型留在这里。
          <br />
          转动视角，慢慢看见每一处细节。
        </p>
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
        <section className="archive-view" aria-label="模型查看器">
          <div
            className="archive-stage"
            role="application"
            tabIndex={0}
            aria-label="模型操作区域"
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                viewer.current?.rotate(-0.2);
                e.preventDefault();
              }
              if (e.key === 'ArrowRight') {
                viewer.current?.rotate(0.2);
                e.preventDefault();
              }
              if (e.key === '+' || e.key === '=') {
                viewer.current?.zoom(0.85);
                e.preventDefault();
              }
              if (e.key === '-') {
                viewer.current?.zoom(1.18);
                e.preventDefault();
              }
              if (e.key.toLowerCase() === 'r') viewer.current?.reset();
            }}
          >
            <div ref={host} className="archive-canvas" />
            <div className="archive-stage-top">
              <span>
                <i />
                LIVE 3D VIEW
              </span>
              <span>
                {String(
                  items.findIndex((i) => i.id === selected.id) + 1,
                ).padStart(2, '0')}{' '}
                / {String(items.length).padStart(2, '0')}
              </span>
            </div>
            {(status.loading || status.error) && (
              <output className="archive-loading">
                {status.loading ? (
                  <>
                    <LoaderCircle className="archive-spinner" size={26} />
                    <p>正在布置展台…</p>
                  </>
                ) : (
                  <>
                    <Box size={30} />
                    <p>{status.error}</p>
                    <button
                      onClick={() =>
                        engineReady
                          ? void viewer.current?.select(selected)
                          : setEngineRetry((n) => n + 1)
                      }
                    >
                      重新载入
                    </button>
                  </>
                )}
              </output>
            )}
            <div className="archive-stage-caption">
              <span>拖动旋转 · 滚轮缩放 · 双指平移</span>
              <span>← → 旋转 &nbsp; ＋ − 缩放 &nbsp; R 复位</span>
            </div>
          </div>
          <div className="archive-controls">
            <div>
              <button
                aria-label="向左旋转模型"
                onClick={() => viewer.current?.rotate(-Math.PI / 8)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="向右旋转模型"
                onClick={() => viewer.current?.rotate(Math.PI / 8)}
              >
                <ChevronRight size={18} />
              </button>
              <span />
              <button
                aria-label="放大模型"
                onClick={() => viewer.current?.zoom(0.8)}
              >
                <Plus size={18} />
              </button>
              <button
                aria-label="缩小模型"
                onClick={() => viewer.current?.zoom(1.25)}
              >
                <Minus size={18} />
              </button>
              <button
                aria-label="复位模型视角"
                onClick={() => viewer.current?.reset()}
              >
                <RotateCcw size={17} />
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              缓慢旋转
            </label>
            <button
              className="archive-fit"
              onClick={() => viewer.current?.reset()}
            >
              <Expand size={16} />
              <span>完整查看</span>
            </button>
          </div>
          <div className="archive-caption">
            <div>
              <small>{selected.category}</small>
              <h2>{selected.title}</h2>
            </div>
            <p>
              {selected.description ||
                '一件值得慢慢观看的私人藏品。拖动模型，从不同方向发现它的造型。'}
            </p>
          </div>
        </section>
        <aside className="archive-shelf" aria-label="藏品列表">
          <div className="archive-shelf-heading">
            <h2>展柜藏品</h2>
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
              给下一件喜欢的模型
              <br />
              <strong>留一个位置</strong>
            </span>
            <ArrowUpRight size={17} />
          </button>
        </aside>
      </div>
      <footer className="archive-footer">
        <span>SATORI / A PLACE FOR THINGS YOU LOVE</span>
        <span>选一件藏品，换一个角度。</span>
      </footer>
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
          <DialogTitle>
            {studio.admin ? '收下一件喜欢的造型' : '管理我的藏品'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            为小屋展柜添加模型和说明。
          </DialogDescription>
          {studio.admin ? (
            <form onSubmit={upload}>
              <p>模型保存到小屋展柜，之后回来仍可查看。</p>
              <label className="archive-file">
                <Upload size={27} />
                <strong>{file ? file.name : '选择一个 3D 模型'}</strong>
                <span>
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : 'GLB · 包含贴图 · 最大 80 MB'}
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
              <button
                className="archive-submit"
                disabled={!file || busy || !title.trim()}
              >
                {busy ? (
                  <LoaderCircle className="archive-spinner" size={17} />
                ) : (
                  <Plus size={17} />
                )}
                <span>{busy ? '正在存入展柜…' : '存入展柜'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={login}>
              <p>访客可以自由观看，新增藏品需要小屋的管理暗号。</p>
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
            <p className="archive-upload-message" role="alert">
              {message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
