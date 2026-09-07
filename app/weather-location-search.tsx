'use client';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { WeatherLocation } from './live-weather';
export default function WeatherLocationSearch({
  onChoose,
}: {
  onChoose: (place: WeatherLocation) => void;
}) {
  const [query, setQuery] = useState(''),
    [places, setPlaces] = useState<WeatherLocation[]>([]),
    [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setBusy(true);
    setMessage('');
    setPlaces([]);
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({
        name: query.trim(),
        count: '5',
        language: 'zh',
        format: 'json',
      }).toString();
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) throw new Error();
      const data = await r.json();
      const results = (Array.isArray(data.results) ? data.results : []).filter(
        (p: Record<string, unknown>) =>
          typeof p.name === 'string' &&
          typeof p.latitude === 'number' &&
          Number.isFinite(p.latitude) &&
          Math.abs(p.latitude) <= 90 &&
          typeof p.longitude === 'number' &&
          Number.isFinite(p.longitude) &&
          Math.abs(p.longitude) <= 180,
      );
      if (request.current !== controller) return;
      setPlaces(
        results.map(
          (p: {
            name: string;
            admin1?: string;
            country?: string;
            latitude: number;
            longitude: number;
            timezone?: string;
          }) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            name: [p.name, p.admin1 !== p.name ? p.admin1 : '', p.country]
              .filter(Boolean)
              .join(' · '),
            timezone: p.timezone,
          }),
        ),
      );
      if (!results.length) setMessage('未找到城市，可尝试英文名');
    } catch {
      if (request.current === controller)
        setMessage('城市搜索暂不可用，请重试');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setBusy(false);
    }
  }
  return (
    <div className="weather-city">
      <form onSubmit={search}>
        <input
          aria-label="搜索天气城市"
          placeholder="或搜索城市"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          minLength={2}
          maxLength={100}
        />
        <button
          aria-label="搜索城市"
          disabled={busy || query.trim().length < 2}
        >
          <Search size={15} />
        </button>
      </form>
      {message && <output>{message}</output>}
      {places.length > 0 && (
        <ul aria-label="城市搜索结果">
          {places.map((p, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  onChoose(p);
                  setPlaces([]);
                  setQuery('');
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
