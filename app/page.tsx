'use client';
/* Local data-URL previews are already resized on upload; no image optimization server is used. */
/* oxlint-disable next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Expand,
  Grid2X2,
  House,
  LampDesk,
  TvMinimal,
  LoaderCircle,
  Minus,
  Music2,
  Plus,
  RotateCcw,
  Settings2,
  Upload,
  UserRound,
  X,
  Download,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  objects,
  defaultProfile,
  type ObjectId,
  type RoomApi,
  type Profile,
} from './room-data';
import StudioArt from './studio-art';
import Television from './television';
import Computer from './computer';
import WallArtEditor from './wall-art-editor';
import {
  rooms,
  roomForObject,
  type HouseView,
  type RoomId,
} from './house-data';
import EnvironmentPicker from './environment-picker';
import { times, weathers } from './environment-data';
import { useLiveEnvironment } from './use-live-environment';
import { useVisibleViewport } from './use-visible-viewport';
type Modal =
  | 'computer'
  | 'wallArt'
  | 'tv'
  | 'works'
  | 'about'
  | 'photos'
  | 'book'
  | 'settings'
  | 'help'
  | 'objects'
  | null;
const storageKey = 'satori-studio-v1';
const safeUrl = (s: string) => {
  try {
    const u = new URL(s);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
};
function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Profile;
  return (
    typeof v.name === 'string' &&
    v.name.length <= 50 &&
    typeof v.subtitle === 'string' &&
    v.subtitle.length <= 80 &&
    typeof v.about === 'string' &&
    v.about.length <= 3000 &&
    Array.isArray(v.projects) &&
    v.projects.length >= 1 &&
    v.projects.length <= 12 &&
    v.projects.every(
      (p) =>
        p &&
        ['title', 'category', 'description', 'url', 'image'].every(
          (k) => typeof p[k as keyof typeof p] === 'string',
        ) &&
        p.title.length <= 100 &&
        p.description.length <= 3000 &&
        (!p.image || /^data:image\/(png|jpeg|webp);base64,/.test(p.image)),
    ) &&
    Array.isArray(v.photos) &&
    v.photos.length <= 6 &&
    v.photos.every(
      (s) =>
        typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(s),
    )
  );
}
export default function Home() {
  useVisibleViewport();
  const [view, setView] = useState<HouseView>('study');
  const live = useLiveEnvironment();
  const { environment, setEnvironment } = live;
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const night = environment.time === 'night';
  const host = useRef<HTMLDivElement>(null),
    api = useRef<RoomApi | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false),
    [lamp, setLamp] = useState(true),
    [music, setMusic] = useState(false);
  const [selected, setSelected] = useState<ObjectId | null>(null),
    [hover, setHover] = useState<{ id: ObjectId; x: number; y: number } | null>(
      null,
    );
  const [modal, setModal] = useState<Modal>(null),
    [project, setProject] = useState(0),
    [photo, setPhoto] = useState(0),
    [page, setPage] = useState(0);
  const [profile, setProfile] = useState<Profile>(defaultProfile),
    [draft, setDraft] = useState<Profile>(defaultProfile),
    [note, setNote] = useState(''),
    [toast, setToast] = useState(''),
    [savingImage, setSavingImage] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    audio = useRef<{
      ctx: AudioContext;
      timer: ReturnType<typeof setInterval>;
    } | null>(null);
  const notify = useCallback((s: string) => {
    setToast(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2800);
  }, []);
  useEffect(() => {
    let disposed = false;
    import('./room-scene')
      .then(({ createRoom }) => {
        if (disposed || !host.current) return;
        try {
          api.current = createRoom(host.current, {
            onSelect: (id) => {
              setSelected(id === 'computer' ? null : id);
              if (id === 'computer') setModal('computer');
            },
            onView: setView,
            onHover: (id, x, y) => setHover(id ? { id, x, y } : null),
            onReady: () => setReady(true),
          });
        } catch (e) {
          console.error(e);
          setError(true);
        }
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      api.current?.dispose();
      api.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const p = JSON.parse(stored);
          if (validProfile(p))
            setProfile({
              ...p,
              subtitle: /^personal\s+studio$/i.test(p.subtitle.trim())
                ? 'STUDIO'
                : p.subtitle,
            });
        }
        setNote(
          localStorage.getItem('satori-studio-note') ||
            '光落在桌上的时候，\n新的想法也刚好出现。',
        );
      } catch {
        notify('无法读取本地内容，已打开默认布置。');
      }
    });
    return () => {
      active = false;
    };
  }, [notify]);
  useEffect(() => {
    api.current?.setEnvironment(environment);
  }, [environment, ready]);
  useEffect(() => {
    api.current?.setLamp(lamp);
  }, [lamp, ready]);
  useEffect(() => {
    api.current?.setMusic(music);
  }, [music, ready]);
  useEffect(() => {
    api.current?.setArtwork(profile.projects.map((p) => p.image));
  }, [profile, ready]);
  useEffect(
    () => () => {
      if (audio.current) {
        clearInterval(audio.current.timer);
        void audio.current.ctx.close();
      }
    },
    [],
  );
  const toggleMusic = async () => {
    if (audio.current) {
      clearInterval(audio.current.timer);
      void audio.current.ctx.close();
      audio.current = null;
      setMusic(false);
      return;
    }
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const master = ctx.createGain();
      master.gain.value = 0.055;
      master.connect(ctx.destination);
      let step = 0;
      const play = () => {
        const notes = [130.81, 164.81, 196, 246.94, 220, 196, 164.81, 146.83];
        for (const ratio of [1, 2, 3]) {
          const osc = ctx.createOscillator(),
            env = ctx.createGain(),
            t = ctx.currentTime;
          osc.type = 'sine';
          osc.frequency.value = notes[step % 8] * ratio;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.3 / ratio, t + 0.04);
          env.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
          osc.connect(env);
          env.connect(master);
          osc.start(t);
          osc.stop(t + 3.3);
          osc.onended = () => {
            osc.disconnect();
            env.disconnect();
          };
        }
        step++;
      };
      play();
      audio.current = { ctx, timer: setInterval(play, 1150) };
      setMusic(true);
    } catch {
      notify('声音未能开启，请再试一次。');
    }
  };
  const visit = (next: HouseView) => {
    api.current?.setView(next);
    setSelected(null);
    setHover(null);
  };
  const tvPower = useCallback(
    (on: boolean, source?: string) => api.current?.setTelevision(on, source),
    [],
  );
  const computerScreen = useCallback(
    (element: HTMLElement | null) => api.current?.setComputerScreen(element),
    [],
  );
  const computerPower = useCallback(
    (on: boolean) => api.current?.setComputerPower(on),
    [],
  );
  const wallPictures = useCallback(
    (pictures: Record<string, string>) =>
      api.current?.setWallPictures(pictures),
    [],
  );
  const tvScreen = useCallback(
    (element: HTMLElement | null) => api.current?.setTVScreen(element),
    [],
  );
  const reset = () => {
    api.current?.reset();
    setSelected(null);
    setHover(null);
  };
  const choose = (id: ObjectId) => {
    setModal(null);
    setSelected(id === 'computer' ? null : id);
    if (id === 'computer') setModal('computer');
    api.current?.focus(id);
  };
  const action = (id: ObjectId) => {
    if (id === 'computer') {
      setModal('computer');
      setSelected(null);
      return;
    }
    if (/^(livingArt[12]|galleryArt[123])$/.test(id)) {
      setModal('wallArt');
      return;
    }
    if (id === 'television') {
      setSelected(null);
      setModal('tv');
      return;
    }
    if (id === 'desk' || id === 'frame' || id === 'galleryArt') {
      setModal('works');
      return;
    }
    if (id === 'about') {
      setModal('about');
      return;
    }
    if (id === 'camera') {
      setPhoto(0);
      setModal('photos');
      return;
    }
    if (id === 'shelf' || id === 'bedroomBook') {
      setModal('book');
      return;
    }
    if (id === 'window' || id.endsWith('Window')) {
      setEnvironmentOpen(true);
      return;
    }
    if (id === 'record') {
      void toggleMusic();
      return;
    }
    if (id === 'wall' || id === 'floor') {
      reset();
      return;
    }
    api.current?.interact(id);
    if (id === 'plant' || id === 'deskPlant' || id === 'shelfPlant')
      notify('给绿意一点水。');
    if (id === 'coffee') notify('咖啡好了。');
  };
  const openEditor = () => {
    setDraft(structuredClone(profile));
    setModal('settings');
  };
  const save = () => {
    if (!draft.name.trim()) {
      notify('请填写展示名称。');
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setProfile(structuredClone(draft));
      setProject(0);
      setModal(null);
      notify('已保存到本机。');
    } catch {
      notify('本地空间不足，请减少图片后再保存。');
    }
  };
  const upload = async (file: File | undefined, index: number | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      notify('请选择小于 20 MB 的图片。');
      return;
    }
    setSavingImage(true);
    try {
      const bitmap = await createImageBitmap(file),
        canvas = document.createElement('canvas'),
        ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas
        .getContext('2d')!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = canvas.toDataURL('image/jpeg', 0.82);
      setDraft((p) =>
        index === null
          ? { ...p, photos: [...p.photos, image].slice(0, 6) }
          : {
              ...p,
              projects: p.projects.map((x, i) =>
                i === index ? { ...x, image } : x,
              ),
            },
      );
    } catch {
      notify('无法读取这张图片。');
    } finally {
      setSavingImage(false);
    }
  };
  const exportProfile = () => {
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(profile, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = u;
    a.download = 'satori-studio.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  const importProfile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw Error();
      const p = JSON.parse(await file.text());
      if (!validProfile(p)) throw Error();
      setDraft(p);
      notify('已导入，保存后生效。');
    } catch {
      notify('这不是有效的工作室配置文件。');
    }
  };
  const fullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('当前浏览器不支持全屏。');
    }
  };
  const current =
    profile.projects[Math.min(project, profile.projects.length - 1)];
  return (
    <main
      className={`studio ${night ? 'night' : ''} ${selected ? 'focused' : ''}`}
    >
      <div ref={host} className="scene" />
      <div className="viewport-ui">
        <header className="studio-header">
          <button
            className="wordmark"
            onClick={reset}
            aria-label="回到工作室全景"
          >
            <span className="brand-dot" />
            <span>
              {profile.name}
              <small>{profile.subtitle}</small>
            </span>
          </button>
          <div className="top-actions">
            <span className="day-caption">
              {live.mode === 'live'
                ? `${live.clock} · ${live.weather ? (live.stale ? '天气待更新' : weathers.find((w) => w.id === environment.weather)?.label) : '天气待定位'}`
                : `${times.find((t) => t.id === environment.time)?.label} · 预览`}
            </span>
            <EnvironmentPicker
              value={environment}
              live={live}
              onChange={setEnvironment}
              open={environmentOpen}
              onOpenChange={setEnvironmentOpen}
            />
            <button
              className="icon-button"
              aria-label="编辑工作室"
              onClick={openEditor}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <nav className="room-navigation" aria-label="房间切换">
          {(Object.keys(rooms) as RoomId[]).map((id) => (
            <button
              key={id}
              aria-pressed={view === id}
              onClick={() => visit(id)}
            >
              {rooms[id].name}
            </button>
          ))}
          <i />
          <button
            aria-label="房屋俯瞰图"
            aria-pressed={view === 'plan'}
            onClick={() => visit('plan')}
          >
            <Grid2X2 size={14} />
            <span>俯瞰</span>
          </button>
        </nav>
        {!ready && (
          <output className="loading">
            {error ? (
              <>
                <p>小屋暂时无法显示</p>
                <small>请启用浏览器硬件加速后重试。</small>
                <button onClick={() => location.reload()}>重新打开</button>
              </>
            ) : (
              <>
                <LoaderCircle className="spin" size={24} />
                <span>推开工作室的门…</span>
              </>
            )}
          </output>
        )}
        {hover && !selected && ready && (
          <div
            className="hover-label"
            style={{
              left: Math.max(
                12,
                Math.min(
                  hover.x + 16,
                  typeof window === 'undefined'
                    ? 1000
                    : window.innerWidth - 170,
                ),
              ),
              top: Math.max(85, hover.y - 40),
            }}
          >
            <span className="brand-dot" />
            {objects[hover.id].name}
            <ArrowUpRight size={13} />
          </div>
        )}
        {selected && (
          <aside className="object-card" aria-live="polite">
            <div>
              <small>{objects[selected].kind}</small>
              <button
                className="icon-button"
                aria-label="关闭物件详情"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            </div>
            <h2>{objects[selected].name}</h2>
            <button className="object-action" onClick={() => action(selected)}>
              {selected === 'lamp'
                ? lamp
                  ? '关灯'
                  : '开灯'
                : selected === 'record'
                  ? music
                    ? '暂停唱片'
                    : '播放唱片'
                  : objects[selected].action}
              <ArrowUpRight size={16} />
            </button>
            <button className="return-link" onClick={reset}>
              <ArrowLeft size={12} />
              返回全景
            </button>
          </aside>
        )}
        <div className="room-caption">
          <span>
            {view === 'overview' || view === 'plan'
              ? 'SATORI / THE HOUSE'
              : `${rooms[view].number} / ${rooms[view].english}`}
          </span>
          <p>
            {view === 'plan'
              ? '四间屋，一种生活。'
              : view === 'overview'
                ? '一所屋，关于我。'
                : rooms[view].name}
          </p>
        </div>
        <div className="view-tools">
          <button
            className="icon-button"
            aria-label="放大"
            onClick={() => api.current?.zoom(1)}
            disabled={!ready}
          >
            <Plus size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="缩小"
            onClick={() => api.current?.zoom(-1)}
            disabled={!ready}
          >
            <Minus size={17} />
          </button>
          <i />
          <button className="icon-button" aria-label="重置视角" onClick={reset}>
            <RotateCcw size={16} />
          </button>
          <button
            className="icon-button fullscreen"
            aria-label="全屏"
            onClick={fullScreen}
          >
            <Expand size={16} />
          </button>
        </div>
        <footer className="bottom-bar">
          <div className="interaction-hint">
            拖动环顾<span>·</span>点击物件
          </div>
          <nav className="dock" aria-label="工作室导航">
            <button
              className={view === 'overview' ? 'active' : ''}
              onClick={() => visit('overview')}
              aria-label="整屋全景"
            >
              <House size={17} />
              <span>整屋</span>
            </button>
            <button onClick={() => setModal('works')}>
              <Grid2X2 size={16} />
              <span>作品</span>
            </button>
            <button onClick={() => setModal('about')}>
              <UserRound size={16} />
              <span>关于</span>
            </button>
            <i />
            <button
              className={lamp ? 'lit' : ''}
              onClick={() => setLamp((v) => !v)}
              aria-label="全屋照明"
              aria-pressed={lamp}
            >
              <LampDesk size={18} />
            </button>
            {view === 'living' && (
              <button
                aria-label="电视遥控器"
                onClick={() => {
                  api.current?.focus('television');
                  setSelected(null);
                  setModal('tv');
                }}
              >
                <TvMinimal size={18} />
              </button>
            )}
            <button
              className={music ? 'lit' : ''}
              onClick={toggleMusic}
              aria-label="唱片开关"
              aria-pressed={music}
            >
              <Music2 size={17} />
              {music && <span className="sound-dot" />}
            </button>
          </nav>
          <button
            className="help-button"
            onClick={() => setModal('objects')}
            aria-label="探索所有物件"
          >
            <span>探索</span>
            <Plus size={16} />
          </button>
        </footer>
        {toast && (
          <output className="toast">
            <Check size={15} />
            {toast}
          </output>
        )}
      </div>
      {ready && (
        <Television
          open={modal === 'tv'}
          active={view === 'living'}
          onClose={() => setModal(null)}
          onPower={tvPower}
          onScreen={tvScreen}
        />
      )}
      {ready && (
        <>
          <Computer
            active={view === 'study'}
            open={modal === 'computer'}
            onClose={() => setModal(null)}
            onScreen={computerScreen}
            onPower={computerPower}
          />
          <WallArtEditor
            selected={selected}
            open={modal === 'wallArt'}
            onClose={() => setModal(null)}
            onChange={wallPictures}
            onFrame={(id) => {
              api.current?.focus(id);
              setSelected(id);
            }}
          />
        </>
      )}
      <Dialog
        open={modal !== null && !['tv', 'computer', 'wallArt'].includes(modal)}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={`studio-dialog ${modal === 'works' || modal === 'photos' ? 'gallery-dialog' : ''} ${modal === 'settings' ? 'settings-dialog' : ''} ${modal === 'tv' ? 'cinema-dialog' : ''}`}
        >
          <DialogClose
            className="dialog-close icon-button"
            aria-label="关闭弹窗"
          >
            <X size={17} />
          </DialogClose>
          <DialogTitle>
            {
              (
                {
                  tv: '家庭影院',
                  works: '精选作品',
                  about: '关于我',
                  photos: '镜头里的日常',
                  book: '灵感手记',
                  settings: '布置你的工作室',
                  help: '随意探索',
                  objects: '屋内物件',
                } as Record<string, string>
              )[modal || '']
            }
          </DialogTitle>
          <DialogDescription>
            {modal === 'tv'
              ? 'SATORI / HOME CINEMA'
              : modal === 'settings'
                ? '内容与图片仅保存在当前浏览器。'
                : modal === 'works'
                  ? 'SELECTED WORK'
                  : modal === 'photos'
                    ? 'COLLECTED MOMENTS'
                    : modal === 'about'
                      ? 'A LITTLE ABOUT ME'
                      : 'SATORI / PERSONAL COLLECTION'}
          </DialogDescription>
          {modal === 'works' && (
            <div className="project-layout">
              <div className="art-wrap">
                <StudioArt
                  index={project}
                  image={current.image}
                  title={current.title}
                />
              </div>
              <div className="project-copy">
                <span className="studio-kicker">{current.category}</span>
                <h2>{current.title}</h2>
                <p>{current.description}</p>
                {safeUrl(current.url) && (
                  <a
                    className="dark-button"
                    href={safeUrl(current.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开作品
                    <ArrowUpRight size={16} />
                  </a>
                )}
                <div className="project-pagination">
                  <button
                    className="icon-button"
                    aria-label="上一件作品"
                    onClick={() =>
                      setProject(
                        (v) =>
                          (v + profile.projects.length - 1) %
                          profile.projects.length,
                      )
                    }
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <span>
                    {String(project + 1).padStart(2, '0')}
                    <em>
                      {' '}
                      / {String(profile.projects.length).padStart(2, '0')}
                    </em>
                  </span>
                  <button
                    className="icon-button"
                    aria-label="下一件作品"
                    onClick={() =>
                      setProject((v) => (v + 1) % profile.projects.length)
                    }
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {modal === 'about' && (
            <div className="about-content">
              <div className="personal-seal">{profile.name.slice(0, 1)}</div>
              <span className="studio-kicker">{profile.subtitle}</span>
              <h2>{profile.name}</h2>
              <p>{profile.about}</p>
              <button className="text-button" onClick={() => setModal('works')}>
                去看看我的作品
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {modal === 'photos' && (
            <div className="photo-content">
              <div className="photo-frame">
                <StudioArt
                  index={photo % 3}
                  image={profile.photos[photo] || ''}
                  title={`收藏 ${photo + 1}`}
                />
              </div>
              <div className="photo-pagination">
                <button
                  className="icon-button"
                  aria-label="上一张收藏"
                  onClick={() =>
                    setPhoto(
                      (v) =>
                        (v + (profile.photos.length || 3) - 1) %
                        (profile.photos.length || 3),
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {photo + 1} / {profile.photos.length || 3}
                </span>
                <button
                  className="icon-button"
                  aria-label="下一张收藏"
                  onClick={() =>
                    setPhoto((v) => (v + 1) % (profile.photos.length || 3))
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
          {modal === 'book' && (
            <div className="notebook">
              <div className="notebook-tabs">
                <button
                  className={page === 0 ? 'active' : ''}
                  onClick={() => setPage(0)}
                >
                  扉页
                </button>
                <button
                  className={page === 1 ? 'active' : ''}
                  onClick={() => setPage(1)}
                >
                  我的随记
                </button>
              </div>
              {page === 0 ? (
                <div className="book-page">
                  <small>NOTES ON OBSERVATION</small>
                  <h2>留一点空白。</h2>
                  <p>
                    一束光，一片叶子，一段没有目的的散步。
                    <br />
                    <br />
                    想法不总是在工作时出现。
                    <br />
                    有时，它藏在你停下来的那一刻。
                  </p>
                  <span>01</span>
                </div>
              ) : (
                <>
                  <label className="sr-only" htmlFor="notebook">
                    我的随记
                  </label>
                  <textarea
                    id="notebook"
                    maxLength={5000}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      try {
                        localStorage.setItem(
                          'satori-studio-note',
                          e.target.value,
                        );
                      } catch {
                        notify('随记未能保存，本地存储空间不足。');
                      }
                    }}
                  />
                  <small>仅保存在此浏览器 · {note.length}/5000</small>
                </>
              )}
            </div>
          )}
          {modal === 'objects' && (
            <>
              <div className="objects-grid">
                {(Object.keys(objects) as ObjectId[])
                  .filter(
                    (id) =>
                      !['floor', 'wall'].includes(id) &&
                      (view === 'overview' ||
                        view === 'plan' ||
                        roomForObject(id) === view),
                  )
                  .map((id, i) => (
                    <button key={id} onClick={() => choose(id)}>
                      <small>{String(i + 1).padStart(2, '0')}</small>
                      <span>{objects[id].name}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
              </div>
              <button className="text-button" onClick={() => setModal('help')}>
                <CircleHelp size={15} />
                操作提示
              </button>
            </>
          )}
          {modal === 'help' && (
            <div className="help-content">
              <p>
                顶部切换房间，底部「整屋」查看四间房，或点击「俯瞰」看平面布局。拖动空白处环顾，滚轮或双指缩放。
              </p>
              <p>
                点击物件靠近，再使用物件卡上的按钮：打开抽屉、转动雕塑、浇水、换布料，或浏览作品。
              </p>
              <p>
                右上角选择时间与天气，或编辑个人内容。底部可开灯、播放原创合成旋律，或回到全景。
              </p>
              <p>
                客厅电视可播放
                YouTube、视频直链或本地视频。播放在线内容时需要网络，关闭播放器会停止播放。本地视频不会上传。
              </p>
              <p>键盘可从「探索」访问当前房间物件。弹窗按 Esc 关闭。</p>
            </div>
          )}
          {modal === 'settings' && (
            <div className="editor">
              <div className="editor-fields">
                <label>
                  展示名称
                  <input
                    value={draft.name}
                    maxLength={50}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  一句短标题
                  <input
                    value={draft.subtitle}
                    maxLength={80}
                    onChange={(e) =>
                      setDraft({ ...draft, subtitle: e.target.value })
                    }
                  />
                </label>
                <label>
                  关于你
                  <textarea
                    value={draft.about}
                    maxLength={3000}
                    onChange={(e) =>
                      setDraft({ ...draft, about: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="editor-section-title">
                作品集<small>原创示例可替换；前三件同步作品墙</small>
              </div>
              {draft.projects.map((p, i) => (
                <details key={i} className="project-editor" open={i === 0}>
                  <summary>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {p.title || '未命名作品'}
                  </summary>
                  <div className="editor-fields">
                    <label>
                      作品名称
                      <input
                        value={p.title}
                        maxLength={100}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            projects: draft.projects.map((p, j) =>
                              j === i ? { ...p, title: e.target.value } : p,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      分类
                      <input
                        value={p.category}
                        maxLength={80}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            projects: draft.projects.map((p, j) =>
                              j === i ? { ...p, category: e.target.value } : p,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      说明
                      <textarea
                        value={p.description}
                        maxLength={3000}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            projects: draft.projects.map((p, j) =>
                              j === i
                                ? { ...p, description: e.target.value }
                                : p,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      作品链接
                      <input
                        type="url"
                        placeholder="https://"
                        value={p.url}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            projects: draft.projects.map((p, j) =>
                              j === i ? { ...p, url: e.target.value } : p,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="image-field">
                      <div className="mini-art">
                        <StudioArt index={i} image={p.image} />
                      </div>
                      <label className="upload-button">
                        <Upload size={15} />
                        {p.image ? '替换封面' : '上传封面'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={savingImage}
                          onChange={(e) => {
                            void upload(e.target.files?.[0], i);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {p.image && (
                        <button
                          className="text-button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              projects: draft.projects.map((p, j) =>
                                j === i ? { ...p, image: '' } : p,
                              ),
                            })
                          }
                        >
                          还原
                        </button>
                      )}
                    </div>
                    {draft.projects.length > 1 && (
                      <button
                        className="text-button remove-project"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            projects: draft.projects.filter((_, j) => j !== i),
                          })
                        }
                      >
                        移除这件作品
                      </button>
                    )}
                  </div>
                </details>
              ))}
              {draft.projects.length < 12 && (
                <button
                  className="text-button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      projects: [
                        ...draft.projects,
                        {
                          title: '新作品',
                          category: 'SELECTED WORK',
                          description: '',
                          url: '',
                          image: '',
                        },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  添加作品
                </button>
              )}
              <div className="editor-section-title">
                相机收藏<small>最多 6 张</small>
              </div>
              <div className="photo-editor">
                {draft.photos.map((src, i) => (
                  <div key={i}>
                    <img src={src} alt={`收藏 ${i + 1}`} />
                    <button
                      aria-label={`移除收藏 ${i + 1}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          photos: draft.photos.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {draft.photos.length < 6 && (
                  <label className="upload-button">
                    <Plus size={18} />
                    添加照片
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={savingImage}
                      onChange={(e) => {
                        void upload(e.target.files?.[0], null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="editor-footer">
                <div>
                  <button
                    className="icon-button"
                    aria-label="导出已保存配置"
                    title="导出已保存配置"
                    onClick={exportProfile}
                  >
                    <Download size={17} />
                  </button>
                  <label
                    className="icon-button"
                    aria-label="导入配置"
                    title="导入配置"
                  >
                    <Upload size={17} />
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        void importProfile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <button
                  className="dark-button"
                  onClick={save}
                  disabled={savingImage}
                >
                  {savingImage ? '处理图片…' : '保存布置'}
                  <Check size={15} />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
