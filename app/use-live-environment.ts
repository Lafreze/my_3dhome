'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Environment } from './environment-data';
import {
  deviceEnvironment,
  parseWeather,
  solarPosition,
  timeFromSun,
  weatherURL,
  type CurrentWeather,
  type WeatherLocation,
} from './live-weather';

export function useLiveEnvironment() {
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<'live' | 'manual'>('live');
  const [manual, setManual] = useState<Environment>({
    time: 'afternoon',
    weather: 'clear',
  });
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'locating' | 'loading' | 'ready' | 'error'
  >('idle');
  const [message, setMessage] = useState('允许定位或选择城市');
  const [refreshKey, refresh] = useState(0);
  const mounted = useRef(false),
    locationRequest = useRef(0);
  const weatherAge =
    now && weather ? now.getTime() - weather.timestamp : Infinity;
  const stale =
    !!weather &&
    (weatherAge > 90 * 60000 || weatherAge < -15 * 60000 || status === 'error');
  const chooseLocation = useCallback((place: WeatherLocation) => {
    locationRequest.current++;
    setLocation({
      ...place,
      latitude: Math.round(place.latitude * 100) / 100,
      longitude: Math.round(place.longitude * 100) / 100,
    });
    setWeather(null);
    setMode('live');
    setStatus('loading');
    setMessage('正在获取当地天气');
  }, []);
  const locate = useCallback(() => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setStatus('error');
      setMessage('此浏览器无法定位，请选择城市');
      return;
    }
    const request = ++locationRequest.current;
    setStatus('locating');
    setMessage('正在定位');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!mounted.current || request !== locationRequest.current) return;
        chooseLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          name: '当前位置',
        });
      },
      (e) => {
        if (!mounted.current || request !== locationRequest.current) return;
        setStatus('error');
        setMessage(
          e.code === 1
            ? '定位未允许，可选择城市'
            : e.code === 3
              ? '定位超时，请重试或选择城市'
              : '无法取得位置，可选择城市',
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }, [chooseLocation]);
  useEffect(() => {
    mounted.current = true;
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    let permission: PermissionStatus | undefined;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => {
        if (!mounted.current) return;
        permission = p;
        if (p.state === 'granted') locate();
        p.onchange = () => {
          if (p.state === 'denied') {
            locationRequest.current++;
            setLocation((previous) =>
              previous?.name === '当前位置' ? null : previous,
            );
            setWeather(null);
            setStatus('idle');
            setMessage('定位已关闭，可选择城市');
          }
        };
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      if (permission) permission.onchange = null;
    };
  }, [locate]);
  useEffect(() => {
    if (!location || mode !== 'live') return;
    let dead = false,
      lastFetch = 0;
    let controller: AbortController | null = null;
    const fetchWeather = async () => {
      lastFetch = Date.now();
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12000);
      setStatus('loading');
      setMessage('正在更新天气');
      try {
        const response = await fetch(weatherURL(location), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('天气服务暂不可用');
        const result = parseWeather(await response.json());
        if (dead) return;
        setWeather(result);
        setStatus('ready');
        setMessage('');
        setNow(new Date());
      } catch {
        if (!dead) {
          setStatus('error');
          setMessage('天气暂不可用，可重试');
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    void fetchWeather();
    const timer = setInterval(() => {
      if (!document.hidden) void fetchWeather();
    }, 15 * 60000);
    const visible = () => {
      if (!document.hidden && Date.now() - lastFetch > 10 * 60000)
        void fetchWeather();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      dead = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [location, mode, refreshKey]);
  const environment = useMemo<Environment>(() => {
    if (mode === 'manual') return manual;
    const base = now
      ? deviceEnvironment(now)
      : { time: 'afternoon' as const, weather: 'cloudy' as const };
    if (!location || !now) return base;
    const solar = solarPosition(now, location.latitude, location.longitude);
    return {
      ...base,
      ...(weather
        ? {
            weather: weather.weather,
            cloudCover: weather.cloudCover,
            windSpeed: weather.windSpeed,
            windDirection: weather.windDirection,
            precipitation: weather.precipitation,
          }
        : {}),
      solar,
      time: timeFromSun(solar),
    };
  }, [now, location, weather, mode, manual]);
  const clock = now
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: weather?.timezone ?? location?.timezone,
      }).format(now)
    : '--:--';
  const setEnvironment = (value: Environment) => {
    setManual({ time: value.time, weather: value.weather });
    setMode('manual');
  };
  const setLive = () => setMode('live');
  const setPreview = () => {
    setManual({ time: environment.time, weather: environment.weather });
    setMode('manual');
  };
  return {
    environment,
    setEnvironment,
    mode,
    setLive,
    setPreview,
    location,
    weather,
    status,
    message,
    clock,
    stale,
    locate,
    chooseLocation,
    refresh: () => refresh((k) => k + 1),
  };
}
export type LiveEnvironment = ReturnType<typeof useLiveEnvironment>;
