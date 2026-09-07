'use client';
import { useEffect, useRef } from 'react';
import { Sun, Sunrise, Sunset, Moon, Cloud, CloudRain, X } from 'lucide-react';
import { times, weathers, type Environment } from './environment-data';
const timeIcons = {
  morning: Sunrise,
  afternoon: Sun,
  sunset: Sunset,
  night: Moon,
};
const weatherIcons = { clear: Sun, cloudy: Cloud, rain: CloudRain };
export default function EnvironmentPicker({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: Environment;
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
        </section>
      )}
    </div>
  );
}
