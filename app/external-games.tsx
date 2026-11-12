'use client';
import { useRef, useState } from 'react';
import { useStudio, type ExternalGame } from './studio-settings';

export default function ExternalGames({ edit = false }: { edit?: boolean }) {
  const studio = useStudio();
  const [draft, setDraft] = useState<ExternalGame[] | null>(null);
  const draftRevision = useRef(studio.revision);
  const updateDraft = (games: ExternalGame[]) => {
    if (!draft) draftRevision.current = studio.revision;
    setDraft(games);
  };
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const games = draft ?? studio.settings.externalGames;
  const editing = edit && studio.admin;
  const change = (id: string, field: keyof ExternalGame, value: string) =>
    updateDraft(games.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  return (
    <section className="external-games" aria-label="外链游戏">
      <h3>发现更多世界</h3>
      <p>在新标签页打开，随时回到小屋。</p>
      <div className="external-game-grid">
        {games.map((g) =>
          editing ? (
            <fieldset key={g.id} disabled={busy}>
              <label>
                游戏名称
                <input
                  maxLength={80}
                  value={g.title}
                  onChange={(e) => change(g.id, 'title', e.target.value)}
                />
              </label>
              <label>
                游戏网址
                <input
                  type="url"
                  maxLength={2048}
                  value={g.url}
                  placeholder="https://…"
                  onChange={(e) => change(g.id, 'url', e.target.value)}
                />
              </label>
              <label>
                一句话介绍
                <input
                  maxLength={240}
                  value={g.description}
                  onChange={(e) => change(g.id, 'description', e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => updateDraft(games.filter((v) => v.id !== g.id))}
              >
                移除游戏
              </button>
            </fieldset>
          ) : (
            <a
              className="external-game-card"
              key={g.id}
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>
                {g.title}
                <span aria-hidden="true"> ↗</span>
              </strong>
              <span>{g.description}</span>
              <small>{new URL(g.url).hostname}</small>
            </a>
          ),
        )}
      </div>
      {editing && (
        <div className="external-game-actions">
          <button
            disabled={busy || games.length >= 30}
            onClick={() =>
              updateDraft([
                ...games,
                {
                  id: `game-${crypto.randomUUID()}`,
                  title: '',
                  description: '',
                  url: '',
                },
              ])
            }
          >
            ＋ 添加外链游戏
          </button>
          <button
            disabled={busy || !draft}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                await studio.save(
                  { externalGames: games },
                  draftRevision.current,
                );
                setDraft(null);
                setMessage('游戏列表已保存，所有访客都能看到。');
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : '保存失败，请重试。',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? '保存中…' : '保存游戏列表'}
          </button>
          {draft && (
            <button
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setMessage('');
              }}
            >
              取消修改
            </button>
          )}
        </div>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
