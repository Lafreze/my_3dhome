'use client';
/* Saved sources reconnect on room entry; manual power-off persists across visits. */
import { useEffect, useRef, useState } from 'react';
import { useStudio } from './studio-settings';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Play, Power, Upload, X, Pause } from 'lucide-react';
import { parseVideoSource, type VideoSource } from './video-source';
type YoutubePlayer = { destroy: () => void };
type YoutubeApi = {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onError: (event: { data: number }) => void } },
  ) => YoutubePlayer;
};
declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let youtubePromise: Promise<YoutubeApi> | null = null;
function youtubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubePromise)
    youtubePromise = new Promise<YoutubeApi>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT) resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.onerror = () => {
        youtubePromise = null;
        script.remove();
        reject(new Error('YouTube 暂时无法连接。'));
      };
      document.head.appendChild(script);
    });
  return youtubePromise;
}
export default function Television({
  onPower,
  onScreen,
  open,
  active,
  onClose,
}: {
  onPower: (on: boolean, source?: string) => void;
  onScreen: (screen: HTMLElement | null) => void;
  open: boolean;
  active: boolean;
  onClose: () => void;
}) {
  const studio = useStudio();
  const stored = studio.settings.devices.tv;
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<
    VideoSource | { kind: 'local'; url: string; name: string } | null
  >(null);
  const [error, setError] = useState('');
  const [powered, setPowered] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paused, setPaused] = useState(false);
  const [screenHost] = useState(() => {
    const element = document.createElement('div');
    element.className = 'tv-native-screen';
    element.addEventListener('pointerdown', (event) => event.stopPropagation());
    element.addEventListener('wheel', (event) => event.stopPropagation(), {
      passive: true,
    });
    return element;
  });
  const file = useRef<HTMLInputElement>(null),
    youtubeHost = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const objectUrl = useRef('');
  const [captions, setCaptions] = useState('');
  const captionInput = useRef<HTMLInputElement>(null);
  const captionUrl = useRef('');
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) {
        setPowered(stored.enabled);
        setSource(parseVideoSource(stored.url));
        setUrl(stored.url);
        setLoaded(studio.ready);
      }
    });
    return () => {
      live = false;
    };
  }, [stored.url, stored.enabled, studio.ready]);
  useEffect(() => {
    if (open) closeButton.current?.focus({ preventScroll: true });
  }, [open]);
  const playing = loaded && powered && active;
  useEffect(() => {
    onPower(
      playing,
      source?.kind === 'youtube' ? 'YouTube' : source ? 'Video' : '',
    );
  }, [playing, source, onPower]);
  useEffect(() => {
    return () => {
      onPower(false);
      onScreen(null);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      if (captionUrl.current) URL.revokeObjectURL(captionUrl.current);
    };
  }, [onPower, onScreen]);
  useEffect(() => {
    onScreen(playing && source ? screenHost : null);
    return () => onScreen(null);
  }, [source, playing, screenHost, onScreen]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);
  useEffect(() => {
    if (!playing || source?.kind !== 'youtube' || !youtubeHost.current) return;
    const host = youtubeHost.current;
    const frame = document.createElement('iframe');
    const query = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      autoplay: '1',
      mute: '1',
      origin: location.origin,
      start: String(source.start),
      rel: '0',
    });
    frame.src = `https://www.youtube-nocookie.com/embed/${source.id}?${query}`;
    frame.title = 'YouTube 电视播放器';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    host.appendChild(frame);
    let player: YoutubePlayer | undefined;
    let active = true;
    // Player lifetime follows source and power, independently of the remote control panel.
    void youtubeApi()
      .then((api) => {
        if (!active) return;
        player = new api.Player(frame, {
          events: {
            onError: (event) => {
              if (!active) return;
              setError(
                event.data === 101 || event.data === 150
                  ? '这个视频未开放嵌入播放，可在 YouTube 打开。'
                  : event.data === 100
                    ? '视频不存在或已设为私密。'
                    : 'YouTube 未能播放，可换个视频或在原网页打开。',
              );
            },
          },
        });
      })
      .catch(() => {
        if (active)
          setError('YouTube 暂时无法连接，可在原网页打开或播放本地视频。');
      });
    return () => {
      active = false;
      player?.destroy();
      host.replaceChildren();
    };
  }, [source, playing]);
  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!studio.admin) return;
    const next = parseVideoSource(url);
    if (url.trim() && !next) {
      setError('请输入完整网页网址、YouTube 链接或视频直链。');
      return;
    }
    try {
      await studio.save({
        devices: { tv: { url: url.trim(), enabled: true } },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败。');
      return;
    }
    setError('');
    setSaved(true);
    setPowered(true);
    setSource(next);
    onPower(true, next?.kind === 'youtube' ? 'YouTube' : 'Video');
  };
  const toggle = async () => {
    const next = !powered;
    try {
      if (studio.admin)
        await studio.save({
          devices: { tv: { url: stored.url, enabled: next } },
        });
    } catch {
      setError('电源状态无法保存。');
    }
    setPowered(next);
    onPower(
      next,
      source?.kind === 'youtube' ? 'YouTube' : source ? 'Video' : '',
    );
  };
  return (
    <>
      {createPortal(
        playing && source ? (
          source.kind === 'youtube' ? (
            <div className="youtube-host" ref={youtubeHost} />
          ) : source.kind === 'website' ? (
            <iframe
              src={source.url}
              title="电视网页"
              sandbox="allow-scripts allow-forms allow-popups"
              allow="fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video
              key={source.url}
              ref={video}
              controls
              autoPlay
              muted
              playsInline
              src={source.url}
              aria-label="电视视频播放器"
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onError={() => setError('视频无法读取，请检查格式或换一个链接。')}
            >
              <track
                kind="captions"
                src={captions || undefined}
                srcLang="zh"
                label="字幕"
                default
              />
            </video>
          )
        ) : null,
        screenHost,
      )}
      <section className="tv-remote" hidden={!open} aria-label="电视遥控器">
        <div className="tv-remote-heading">
          <span>家庭影院</span>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="收起电视遥控器"
          >
            <X size={16} />
          </button>
        </div>
        {studio.admin && (
          <form className="tv-source-form" onSubmit={submit}>
            <input
              aria-label="视频链接"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSaved(false);
              }}
              placeholder="网页 / YouTube / 视频直链"
              type="url"
            />
            <button
              type="submit"
              className="tv-play"
              aria-label="保存并播放视频"
              title="保存并播放"
            >
              <Play size={16} fill="currentColor" />
            </button>
          </form>
        )}
        {saved && (
          <output className="device-saved">已保存 · 所有访客均可观看</output>
        )}
        <div className="tv-toolbar">
          {powered &&
            source &&
            source.kind !== 'youtube' &&
            source.kind !== 'website' && (
              <button
                type="button"
                aria-label={paused ? '继续播放' : '暂停视频'}
                onClick={() => {
                  if (video.current?.paused)
                    void video.current
                      .play()
                      .catch(() => setError('请在电视屏幕上点击播放。'));
                  else video.current?.pause();
                }}
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}

          {studio.admin && (
            <button type="button" onClick={() => file.current?.click()}>
              <Upload size={14} />
              本地预览
            </button>
          )}
          <input
            ref={file}
            hidden
            type="file"
            accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv"
            aria-label="选择本地视频"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (!selected || !studio.admin) return;
              if (!/\.(mp4|webm|ogv|ogg)$/i.test(selected.name)) {
                setError('请选择 MP4、WebM 或 Ogg 视频。');
                return;
              }
              if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
              objectUrl.current = URL.createObjectURL(selected);
              setSource({
                kind: 'local',
                url: objectUrl.current,
                name: selected.name,
              });
              setError('');
              setSaved(false);
              setPowered(true);
              onPower(true, selected.name.slice(0, 30));
              e.target.value = '';
            }}
          />
          {source &&
            source.kind !== 'youtube' &&
            source.kind !== 'website' &&
            studio.admin && (
              <>
                <button
                  type="button"
                  onClick={() => captionInput.current?.click()}
                >
                  字幕
                </button>
                <input
                  ref={captionInput}
                  type="file"
                  hidden
                  accept=".vtt,text/vtt"
                  aria-label="选择 VTT 字幕"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (!chosen) return;
                    if (!chosen.name.toLowerCase().endsWith('.vtt')) {
                      setError('字幕请选择 VTT 格式。');
                      return;
                    }
                    if (captionUrl.current)
                      URL.revokeObjectURL(captionUrl.current);
                    captionUrl.current = URL.createObjectURL(chosen);
                    setCaptions(captionUrl.current);
                  }}
                />
              </>
            )}
          {source && source.kind !== 'local' && (
            <a href={source.original} target="_blank" rel="noreferrer">
              原网页
              <ArrowUpRight size={13} />
            </a>
          )}
          <button
            type="button"
            className="tv-power"
            aria-label={powered ? '关闭电视电源' : '打开电视电源'}
            aria-pressed={powered}
            onClick={toggle}
          >
            <Power size={15} />
          </button>
        </div>
        {error && (
          <p className="tv-error" role="alert">
            {error}
          </p>
        )}
        <p className="device-note">
          网址由管理者设置。部分网站限制嵌入，未显示时可在原网页打开；本地预览不会发布。
        </p>
      </section>
    </>
  );
}
