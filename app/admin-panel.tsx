'use client';
import { useState } from 'react';
import {
  appearanceColor,
  appearanceLabels,
  useStudio,
  type Appearance,
} from './studio-settings';
export default function AdminPanel({
  onProfile,
  onDevice,
  onArt,
}: {
  onProfile: () => void;
  onDevice: (id: 'computer' | 'tv') => void;
  onArt: () => void;
}) {
  const studio = useStudio();
  const [colorDraft, setColorDraft] = useState(studio.settings.appearance);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(studio.settings.note),
    [originalNote, setOriginalNote] = useState(studio.settings.note);
  const run = async (action: () => Promise<void>, success = '') => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  if (!studio.admin) return null;
  return (
    <div className="admin-panel">
      <p>已进入管理模式。保存后，所有访客都能看到更新。</p>
      <div className="admin-links">
        <button onClick={onProfile}>
          个人资料与作品集 <span>名称、介绍、项目、相册</span>
        </button>
        <button onClick={() => onDevice('computer')}>
          电脑网页 <span>书房工作站的展示网址</span>
        </button>
        <button onClick={() => onDevice('tv')}>
          电视内容 <span>网页、YouTube 或视频直链</span>
        </button>
        <button onClick={onArt}>
          墙上画作 <span>书房、客厅与展厅的八个画框</span>
        </button>
      </div>
      <fieldset disabled={busy}>
        <legend>家具配色</legend>
        <div className="admin-colors">
          {(Object.keys(appearanceLabels) as (keyof Appearance)[]).map((id) => (
            <div key={id}>
              <span>{appearanceLabels[id]}</span>
              <div>
                <input
                  type="color"
                  aria-label={`${appearanceLabels[id]}颜色`}
                  value={appearanceColor(id, colorDraft[id])}
                  onChange={(e) =>
                    setColorDraft({ ...colorDraft, [id]: e.target.value })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <button
        className="dark-button"
        disabled={busy}
        onClick={() =>
          void run(
            () => studio.save({ appearance: colorDraft }),
            '配色已保存。',
          )
        }
      >
        保存配色
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (studio.settings.note !== originalNote)
              throw Error('随笔已在另一页面更新，请重新打开管理面板。');
            await studio.save({ note });
            setOriginalNote(note);
          }, '随笔已发布。');
        }}
      >
        <label>
          公开随笔
          <textarea
            maxLength={5000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <small>显示在书房与卧室的手记里 · {note.length}/5000</small>
        <button className="dark-button" disabled={busy}>
          保存随笔
        </button>
      </form>
      {message && <output>{message}</output>}
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void run(studio.logout)}
      >
        退出管理模式
      </button>
    </div>
  );
}
