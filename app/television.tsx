'use client';
/* A video source is connected only after the visitor explicitly presses play. */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Play,
  Power,
  Upload,
  Video,
  SquarePlay,
} from 'lucide-react';
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
  onVideo,
}: {
  onPower: (on: boolean, source?: string) => void;
  onVideo: (video: HTMLVideoElement | null) => void;
}) {
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<
    VideoSource | { kind: 'local'; url: string; name: string } | null
  >(null);
  const [error, setError] = useState('');
  const [powered, setPowered] = useState(true);
  const file = useRef<HTMLInputElement>(null),
    youtubeHost = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const objectUrl = useRef('');
  const [captions, setCaptions] = useState('');
  const captionInput = useRef<HTMLInputElement>(null);
  const captionUrl = useRef('');
  useEffect(() => {
    onPower(true);
    return () => {
      onPower(false);
      onVideo(null);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      if (captionUrl.current) URL.revokeObjectURL(captionUrl.current);
    };
  }, [onPower, onVideo]);
  useEffect(() => {
    if (!powered || source?.kind !== 'youtube' || !youtubeHost.current) return;
    const host = youtubeHost.current;
    const frame = document.createElement('iframe');
    const query = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      autoplay: '1',
      origin: location.origin,
      start: String(source.start),
      rel: '0',
    });
    frame.src = `https://www.youtube-nocookie.com/embed/${source.id}?${query}`;
    frame.title = 'YouTube 电视播放器';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    host.appendChild(frame);
    let player: YoutubePlayer | undefined;
    let active = true;
    // The API owns only this isolated host; dispose the player when the television closes.
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
  }, [source, powered]);
  useEffect(() => {
    if (source?.kind === 'local' && video.current) onVideo(video.current);
    else onVideo(null);
    return () => onVideo(null);
  }, [source, powered, onVideo]);
  const submit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = parseVideoSource(url);
    if (!next) {
      setError('请输入 YouTube 链接，或 MP4 / WebM 视频直链。');
      return;
    }
    setError('');
    setPowered(true);
    setSource(next);
    onPower(true, next.kind === 'youtube' ? 'YouTube' : 'Video');
  };
  const toggle = () => {
    const next = !powered;
    setPowered(next);
    onPower(
      next,
      source?.kind === 'youtube' ? 'YouTube' : source ? 'Video' : '',
    );
    if (!next) onVideo(null);
  };
  return (
    <div className="television-player">
      <div className="television-screen">
        {!powered ? (
          <div className="tv-idle">
            <Power size={30} strokeWidth={1} />
            <span>电视已关闭</span>
          </div>
        ) : source?.kind === 'youtube' ? (
          <div className="youtube-host" ref={youtubeHost} />
        ) : source && (source.kind === 'video' || source.kind === 'local') ? (
          <video
            key={source.url}
            ref={video}
            controls
            autoPlay
            playsInline
            src={source.url}
            aria-label="电视视频播放器"
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
        ) : (
          <div className="tv-idle">
            <span className="tv-monogram">S</span>
            <span>选一部，慢慢看。</span>
            <div>
              <SquarePlay size={19} />
              <i />
              <Video size={18} />
            </div>
          </div>
        )}
      </div>
      <form className="tv-source-form" onSubmit={submit}>
        <input
          aria-label="视频链接"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube 链接 / 视频直链"
          type="url"
        />
        <button type="submit" className="tv-play" aria-label="播放视频链接">
          <Play size={16} fill="currentColor" />
        </button>
      </form>
      <div className="tv-toolbar">
        <button type="button" onClick={() => file.current?.click()}>
          <Upload size={14} />
          本地视频
        </button>
        <input
          ref={file}
          hidden
          type="file"
          accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv"
          aria-label="选择本地视频"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (!selected) return;
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
            setPowered(true);
            onPower(true, selected.name.slice(0, 30));
            e.target.value = '';
          }}
        />
        {source && source.kind !== 'youtube' && (
          <>
            <button type="button" onClick={() => captionInput.current?.click()}>
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
                if (captionUrl.current) URL.revokeObjectURL(captionUrl.current);
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
    </div>
  );
}
