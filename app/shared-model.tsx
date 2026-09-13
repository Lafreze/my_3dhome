'use client';
/* oxlint-disable next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, LockKeyhole } from 'lucide-react';
import type { Exhibit } from './exhibit-data';
import ModelPreview from './model-preview';

export default function SharedModel() {
  const [item, setItem] = useState<Exhibit | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const code = /^\/models\/private\/([A-Za-z0-9_-]{43})\/?$/.exec(
      location.pathname,
    )?.[1];
    queueMicrotask(() => setError(''));
    if (!code) {
      queueMicrotask(() => setError('链接不完整，请使用管理员提供的地址。'));
      return;
    }
    fetch(`/api/model-share/${code}`, {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            response.status === 404
              ? '这条私密链接不存在或已失效。'
              : '模型暂时无法读取，请稍后重试。',
          );
        return response.json();
      })
      .then((value) => {
        setItem(value.item);
        document.title = `${value.item.title} · 私密分享 · SATORI`;
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <main className="model-library archive-private-page">
      <header className="archive-header">
        <a className="archive-back" href="/models">
          <ArrowLeft size={17} />
          <span>公开展柜</span>
        </a>
        <a className="archive-brand" href="/">
          SATORI<small>PRIVATE VIEWING</small>
        </a>
        <span className="archive-private-label">
          <LockKeyhole size={15} />
          私密分享
        </span>
      </header>
      <div className="archive-title">
        <div>
          <p>A MOMENT WITH ONE OBJECT</p>
          <h1>
            独享这一件<span>Objects, up close.</span>
          </h1>
        </div>
        <p className="archive-intro">
          一条链接，一件藏品。
          <br />
          只有持有地址的人可以打开。
        </p>
      </div>
      {error ? (
        <section className="archive-share-error" role="alert">
          <LockKeyhole size={30} />
          <h2>暂时无法打开</h2>
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>重试</button>
        </section>
      ) : item ? (
        <ModelPreview item={item} />
      ) : (
        <output className="archive-share-error">
          <LoaderCircle className="archive-spinner" />
          <p>正在打开私密展台…</p>
        </output>
      )}
      <footer className="archive-footer">
        PRIVATE COLLECTION / SATORI<span>本页未加入公开展柜</span>
      </footer>
    </main>
  );
}
