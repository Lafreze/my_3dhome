'use client';
import { useCallback, useEffect, useState } from 'react';
import { rooms, type RoomId } from './house-data';
import { useStudio } from './studio-settings';

type Note = {
  id: string;
  room: RoomId;
  author: string;
  text: string;
  createdAt: string;
};
export default function RoomNotes({ initialRoom }: { initialRoom: RoomId }) {
  const studio = useStudio();
  const [room, setRoom] = useState(initialRoom),
    [notes, setNotes] = useState<Note[]>([]);
  const [author, setAuthor] = useState(''),
    [text, setText] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await fetch('/api/notes', { cache: 'no-store' });
    if (!r.ok) throw Error('暂时没能读到便签，请稍后重试。');
    setNotes((await r.json()).notes);
    setReady(true);
  }, []);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) void refresh().catch((e) => setError(e.message));
    };
    update();
    const timer = setInterval(update, 15000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  return (
    <div className="room-notes">
      <label className="note-room">
        翻看房间的便签
        <select
          value={room}
          onChange={(e) => {
            setRoom(e.target.value as RoomId);
            setPendingDelete(null);
          }}
        >
          {Object.entries(rooms).map(([id, r]) => (
            <option key={id} value={id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="note-stack" aria-live="polite">
        {!ready ? (
          <p>正在读便签…</p>
        ) : !notes.some((n) => n.room === room) ? (
          <p className="note-empty">这张纸还是空的，留一句今天的心情吧。</p>
        ) : null}
        {notes
          .filter((n) => n.room === room)
          .toReversed()
          .map((n) => (
            <article className="guest-note" key={n.id}>
              <p>{n.text}</p>
              <footer>
                <span>
                  {n.author} ·{' '}
                  {new Date(n.createdAt).toLocaleDateString('zh-CN')}
                </span>
                {studio.admin &&
                  (pendingDelete === n.id ? (
                    <span className="note-delete-confirm">
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError('');
                          try {
                            await studio.deleteNote(n.id);
                            await refresh();
                            setPendingDelete(null);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        确认删除
                      </button>
                      <button onClick={() => setPendingDelete(null)}>
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      aria-label={`删除 ${n.author} 的便签`}
                      onClick={() => setPendingDelete(n.id)}
                    >
                      删除
                    </button>
                  ))}
              </footer>
            </article>
          ))}
      </div>
      <form
        className="note-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !text.trim()) return;
          setBusy(true);
          setError('');
          try {
            const r = await fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room, author, text }),
            });
            const value = await r.json();
            if (!r.ok) throw Error(value.error || '便签未保存，请重试。');
            setNotes(value.notes);
            setText('');
            setReady(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          留一张便签
          <textarea
            aria-label="便签内容"
            maxLength={240}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="一段灵感、一句问候，或今天的小事。"
            required
          />
        </label>
        <div className="note-form-bottom">
          <input
            aria-label="便签署名"
            maxLength={16}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="署名（可留空）"
          />
          <span>{text.length}/240</span>
          <button className="primary-button" disabled={busy || !text.trim()}>
            {busy ? '正在保存…' : '贴上便签'}
          </button>
        </div>
        <small>便签会留在小屋里，其他访客也能看到。</small>
      </form>
      {error && (
        <p role="alert" className="note-error">
          {error}
        </p>
      )}
    </div>
  );
}
