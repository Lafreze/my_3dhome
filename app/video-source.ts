export type VideoSource =
  | { kind: 'youtube'; id: string; start: number; original: string }
  | { kind: 'video'; url: string; original: string };
export function parseVideoSource(input: string): VideoSource | null {
  try {
    const url = new URL(input.trim());
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase();
    if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
        'youtu.be',
      ].includes(host)
    ) {
      const path = url.pathname.split('/').filter(Boolean);
      const id =
        host === 'youtu.be'
          ? path[0]
          : path[0] === 'watch'
            ? url.searchParams.get('v')
            : ['embed', 'shorts', 'live'].includes(path[0])
              ? path[1]
              : null;
      if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
      const time =
        url.searchParams.get('t') || url.searchParams.get('start') || '0';
      let start = 0;
      if (/^\d+$/.test(time)) start = Number(time);
      else {
        const parts = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
        if (parts)
          start =
            Number(parts[1] || 0) * 3600 +
            Number(parts[2] || 0) * 60 +
            Number(parts[3] || 0);
      }
      return {
        kind: 'youtube',
        id,
        start: Math.min(start, 86400),
        original: `https://www.youtube.com/watch?v=${id}`,
      };
    }
    if (/\.(mp4|webm|ogv|ogg)$/i.test(url.pathname))
      return { kind: 'video', url: url.href, original: url.href };
    return null;
  } catch {
    return null;
  }
}
