'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Globe2,
  MoveHorizontal,
  Pause,
  Play,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  libraryBooks,
  libraryBookmarkKey,
  readLibraryBookmarks,
  type LibraryBookId,
  type LibrarySnapshot,
} from './library-state';
import { libraryLadderStops } from './library-layout';
import type { RoomApi } from './room-data';
export const libraryObjectIds = {
  libraryShelf: 'shelf',
  libraryBookForest: 'forest',
  libraryBookJourney: 'journey',
  libraryBookHouse: 'house',
  libraryDesk: 'desk',
  libraryLadder: 'ladder',
  libraryGlobe: 'globe',
} as const;
export type LibrarySelection =
  | (typeof libraryObjectIds)[keyof typeof libraryObjectIds]
  | null;
const initial: LibrarySnapshot = {
  book: 'forest',
  page: 0,
  previousPage: 0,
  phase: 'shelved',
  age: 0,
  turn: 1,
  direction: 1,
  ladderStop: 1,
  ladderPosition: libraryLadderStops[1],
  globeSpinning: true,
};
export default function LibraryPanel({
  selection,
  onClose,
  api,
}: {
  selection: LibrarySelection;
  onClose: () => void;
  api: React.RefObject<RoomApi | null>;
}) {
  const [snapshot, setSnapshot] = useState(initial),
    [opened, setOpened] = useState<LibraryBookId | null>(null),
    [saved, setSaved] = useState(true);
  const borrow = useCallback(
    (id: LibraryBookId) => {
      api.current?.libraryCommand({
        type: 'borrow',
        book: id,
        page: readLibraryBookmarks()[id],
      });
      setOpened(id);
      setSnapshot(api.current?.librarySnapshot() || initial);
      api.current?.focus('libraryDesk');
    },
    [api],
  );
  useEffect(() => {
    setOpened(null);
    if (!selection) return;
    if (selection in libraryBooks) borrow(selection as LibraryBookId);
    if (selection === 'desk')
      borrow(api.current?.librarySnapshot().book || 'forest');
    setSnapshot(api.current?.librarySnapshot() || initial);
    const timer = setInterval(
      () => setSnapshot(api.current?.librarySnapshot() || initial),
      80,
    );
    return () => clearInterval(timer);
  }, [selection, api, borrow]);
  useEffect(() => {
    if (snapshot.phase !== 'reading') return;
    const marks = readLibraryBookmarks();
    marks[snapshot.book] = snapshot.page;
    try {
      localStorage.setItem(libraryBookmarkKey, JSON.stringify(marks));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [snapshot.book, snapshot.page, snapshot.phase]);
  const turn = useCallback(
    (direction: 1 | -1) => {
      api.current?.libraryCommand({ type: 'page', direction });
      setSnapshot(api.current?.librarySnapshot() || initial);
    },
    [api],
  );
  useEffect(() => {
    if (!selection || !opened) return;
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        turn(event.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [selection, opened, turn]);
  const reading = opened !== null,
    book = libraryBooks[snapshot.book],
    page = book.pages[snapshot.page],
    turning = snapshot.turn < 1 || snapshot.phase !== 'reading';
  return (
    <Dialog
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="bar-dialog library-dialog"
        showCloseButton={false}
        overlayClassName="bar-overlay"
      >
        <header className="play-heading">
          <div>
            <span className="play-eyebrow">SATORI · THE LIBRARY</span>
            <DialogTitle>
              {reading
                ? book.title
                : selection === 'ladder'
                  ? '让木梯靠近这一格'
                  : selection === 'globe'
                    ? '把远方转到眼前'
                    : '从书架挑一本'}
            </DialogTitle>
          </div>
          <button
            className="play-icon"
            aria-label="返回藏书室"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <DialogDescription className="play-description">
          {reading
            ? book.subtitle
            : selection === 'ladder'
              ? '木梯沿黄铜轨道移动，梯脚前方始终留空。'
              : selection === 'globe'
                ? '在地图之外，留一些想象的地方。'
                : '三本小屋原创短篇，适合一段安静的阅读时间。'}
        </DialogDescription>
        {reading ? (
          <>
            <div className="library-reading-meta">
              <button
                onClick={() => {
                  api.current?.libraryCommand({ type: 'return' });
                  setOpened(null);
                  api.current?.focus('libraryShelf');
                }}
              >
                ‹ 返回书目
              </button>
              <span>
                {snapshot.page + 1} / {book.pages.length}
              </span>
            </div>
            <article className="library-page" aria-label="当前书页">
              <span className="library-page-number">
                — {String(snapshot.page + 1).padStart(2, '0')} —
              </span>
              <h3>{page.title}</h3>
              {page.text.split('\n\n').map((text) => (
                <p key={text}>{text}</p>
              ))}
            </article>
            <div className="library-page-controls">
              <button
                disabled={turning || snapshot.page === 0}
                onClick={() => turn(-1)}
              >
                <ChevronLeft size={16} />
                上一页
              </button>
              <output>
                {snapshot.phase === 'taking'
                  ? '正在从书架取书…'
                  : snapshot.turn < 1
                    ? '书页轻轻翻过'
                    : '慢慢读，不着急'}
              </output>
              <button
                disabled={turning || snapshot.page === book.pages.length - 1}
                onClick={() => turn(1)}
              >
                下一页
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="bar-note">
              可用左右方向键翻页。
              {saved ? '书签保存在此浏览器。' : '书签暂未保存。'}
              返回房间时，书会放回原处。
            </p>
          </>
        ) : selection === 'ladder' ? (
          <>
            <div className="library-ladder-preview">
              <MoveHorizontal size={36} />
              <span>后段 —— 中段 —— 前段</span>
            </div>
            <div className="library-stops">
              {['后段藏书', '书墙中央', '前段藏书'].map((title, i) => (
                <button
                  key={title}
                  aria-pressed={snapshot.ladderStop === i}
                  onClick={() => {
                    api.current?.libraryCommand({ type: 'ladder', stop: i });
                    setSnapshot(api.current?.librarySnapshot() || initial);
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
            <output className="library-device-status">
              {Math.abs(
                snapshot.ladderPosition -
                  libraryLadderStops[snapshot.ladderStop],
              ) < 0.02
                ? '木梯已停稳'
                : '木梯正沿书墙缓缓滑动…'}
            </output>
          </>
        ) : selection === 'globe' ? (
          <>
            <div className="library-globe-preview">
              <Globe2 size={70} />
              <span>
                {snapshot.globeSpinning
                  ? '地球仪正在缓缓旋转'
                  : '停下来，看看这一面'}
              </span>
            </div>
            <button
              className="bar-primary"
              onClick={() => {
                api.current?.libraryCommand({ type: 'globe' });
                setSnapshot(api.current?.librarySnapshot() || initial);
              }}
            >
              {snapshot.globeSpinning ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}{' '}
              {snapshot.globeSpinning ? '暂停旋转' : '继续旋转'}
            </button>
          </>
        ) : (
          <div className="library-book-list">
            {Object.entries(libraryBooks).map(([id, b], i) => (
              <button key={id} onClick={() => borrow(id as LibraryBookId)}>
                <span className="library-cover" style={{ background: b.color }}>
                  <BookOpen size={23} />
                  <small>0{i + 1}</small>
                </span>
                <span>
                  <strong>{b.title}</strong>
                  <small>{b.subtitle}</small>
                  <em>抽书阅读 · 四页短篇</em>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
