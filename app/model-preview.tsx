'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useEffect, useRef, useState } from 'react';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Expand,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type { Exhibit } from './exhibit-data';
import type { ModelViewer } from './model-viewer-scene';
export default function ModelPreview({
  item,
  position = 'PRIVATE VIEW',
  paused = false,
}: {
  item: Exhibit;
  position?: string;
  paused?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    viewer = useRef<ModelViewer | null>(null);
  const [status, setStatus] = useState({ loading: true, error: '' }),
    [engineReady, setEngineReady] = useState(false),
    [engineRetry, setEngineRetry] = useState(0),
    [auto, setAuto] = useState(false);
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
    if (engineReady) void viewer.current?.select(item);
  }, [item, engineReady]);
  useEffect(
    () => viewer.current?.auto(auto && !paused),
    [auto, paused, engineReady],
  );
  useEffect(() => {
    queueMicrotask(() => setAuto(false));
  }, [item.id]);
  return (
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
          <span>{position}</span>
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
                      ? void viewer.current?.select(item)
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
        <button className="archive-fit" onClick={() => viewer.current?.reset()}>
          <Expand size={16} />
          <span>完整查看</span>
        </button>
      </div>
      <div className="archive-caption">
        <div>
          <small>{item.category}</small>
          <h2>{item.title}</h2>
        </div>
        {item.description && <p>{item.description}</p>}
      </div>
    </section>
  );
}
