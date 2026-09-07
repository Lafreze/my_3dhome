'use client';
import { useEffect, useRef } from 'react';
import {
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react';
import WeatherLocationSearch from './weather-location-search';
import type { LiveEnvironment } from './use-live-environment';
import { times, weathers, type Environment } from './environment-data';
const timeIcons = {
  morning: Sunrise,
  afternoon: Sun,
  sunset: Sunset,
  night: Moon,
};
const weatherIcons = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  storm: CloudLightning,
};
export default function EnvironmentPicker({
  value,
  onChange,
  live,
  open,
  onOpenChange,
}: {
  value: Environment;
  live: LiveEnvironment;
  onChange: (value: Environment) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open, onOpenChange]);
  const Icon =
    value.weather === 'clear'
      ? timeIcons[value.time]
      : weatherIcons[value.weather];
  return (
    <div className="environment-picker" ref={root}>
      <button
        ref={trigger}
        className="icon-button"
        aria-label="时间与天气"
        aria-expanded={open}
        aria-controls="environment-panel"
        onClick={() => onOpenChange(!open)}
      >
        <Icon size={19} />
      </button>
      {open && (
        <section
          id="environment-panel"
          className="environment-panel"
          aria-label="时间与天气"
        >
          <div className="environment-heading">
            <span>窗外光景</span>
            <button
              className="icon-button"
              aria-label="收起光景设置"
              onClick={() => {
                onOpenChange(false);
                trigger.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          </div>
          <div className="environment-mode" aria-label="光景模式">
            <button aria-pressed={live.mode === 'live'} onClick={live.setLive}>
              跟随现实
            </button>
            <button
              aria-pressed={live.mode === 'manual'}
              onClick={live.setPreview}
            >
              自由预览
            </button>
          </div>
          {live.mode === 'live' ? (
            <div className="live-weather">
              <div className="weather-reading">
                <strong>{live.clock}</strong>
                <span>
                  {live.weather
                    ? `${Math.round(live.weather.temperature)}°`
                    : '—'}
                </span>
              </div>
              <div className="weather-place">
                {live.location?.name || '设备当地时间'}
              </div>
              <output className="weather-summary">
                {live.stale
                  ? '天气未更新 · 上次记录'
                  : live.status === 'ready' && live.weather
                    ? `${weathers.find((w) => w.id === live.weather!.weather)?.label} · 风速 ${Math.round(live.weather.windSpeed)} km/h`
                    : live.message}
              </output>
              <div className="weather-location-actions">
                <button
                  onClick={live.locate}
                  disabled={live.status === 'locating'}
                >
                  <MapPin size={14} />
                  {live.status === 'locating' ? '正在定位' : '使用当前位置'}
                </button>
                {live.location && (
                  <button
                    aria-label="刷新天气"
                    onClick={live.refresh}
                    disabled={live.status === 'loading'}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
              <WeatherLocationSearch onChoose={live.chooseLocation} />
              <div className="weather-source">
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open-Meteo
                </a>
                <span>
                  {live.weather
                    ? `${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: live.weather.timezone }).format(live.weather.timestamp)} 更新`
                    : '位置取整至约 1 km'}
                </span>
              </div>
            </div>
          ) : (
            <>
              <fieldset
                className="environment-options time-options"
                aria-label="时间"
              >
                {times.map((item) => {
                  const Glyph = timeIcons[item.id];
                  return (
                    <button
                      key={item.id}
                      aria-pressed={value.time === item.id}
                      onClick={() => onChange({ ...value, time: item.id })}
                    >
                      <Glyph size={20} strokeWidth={1.4} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </fieldset>
              <fieldset
                className="environment-options weather-options"
                aria-label="天气"
              >
                {weathers.map((item) => {
                  const Glyph = weatherIcons[item.id];
                  return (
                    <button
                      key={item.id}
                      aria-pressed={value.weather === item.id}
                      onClick={() => onChange({ ...value, weather: item.id })}
                    >
                      <Glyph size={16} strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </fieldset>
            </>
          )}
        </section>
      )}
    </div>
  );
}
