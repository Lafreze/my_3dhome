import type {
  Environment,
  SolarPosition,
  TimeOfDay,
  Weather,
} from './environment-data';

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  name: string;
  timezone?: string;
};
export type CurrentWeather = {
  weather: Weather;
  temperature: number;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  timestamp: number;
  timezone: string;
};

// NOAA fractional-year solar equations. World axes: +X east, -Z north, +Y up.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function solarPosition(
  date: Date,
  latitude: number,
  longitude: number,
): SolarPosition {
  const year = date.getUTCFullYear();
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const day =
    Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const hour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / days) * (day - 1 + (hour - 12) / 24);
  const eq =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const dec =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const ha = (((hour * 60 + eq + 4 * longitude) / 4) * Math.PI) / 180 - Math.PI;
  const lat = (latitude * Math.PI) / 180;
  const up =
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const east = -Math.cos(dec) * Math.sin(ha);
  const north =
    Math.cos(lat) * Math.sin(dec) -
    Math.sin(lat) * Math.cos(dec) * Math.cos(ha);
  return {
    altitude: (Math.asin(Math.max(-1, Math.min(1, up))) * 180) / Math.PI,
    azimuth: ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360,
  };
}

export function timeFromSun(sun: SolarPosition): TimeOfDay {
  if (sun.altitude < -6) return 'night';
  if (sun.altitude < 12) return sun.azimuth < 180 ? 'morning' : 'sunset';
  return sun.azimuth < 150 ? 'morning' : 'afternoon';
}

export function deviceEnvironment(date: Date): Environment {
  const hour = date.getHours() + date.getMinutes() / 60;
  const time: TimeOfDay =
    hour < 5 || hour >= 19
      ? 'night'
      : hour < 10
        ? 'morning'
        : hour >= 17
          ? 'sunset'
          : 'afternoon';
  // An unlocated clock is a clearly labelled preview, never a claimed weather observation.
  return { time, weather: 'cloudy' };
}

export function weatherFromCode(code: number): Weather {
  if ([95, 96, 99].includes(code)) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return 'rain';
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  throw new Error('天气代码暂不支持');
}

export function parseWeather(data: unknown): CurrentWeather {
  const d = data as { current?: Record<string, unknown>; timezone?: unknown };
  const c = d?.current;
  const fields = [
    'weather_code',
    'temperature_2m',
    'cloud_cover',
    'wind_speed_10m',
    'wind_direction_10m',
    'precipitation',
    'time',
  ];
  if (
    !c ||
    fields.some((k) => typeof c[k] !== 'number' || !Number.isFinite(c[k])) ||
    typeof d.timezone !== 'string'
  )
    throw new Error('天气数据不完整');
  const n = c as Record<string, number>;
  if (
    n.cloud_cover < 0 ||
    n.cloud_cover > 100 ||
    n.wind_speed_10m < 0 ||
    n.precipitation < 0 ||
    n.time <= 0
  )
    throw new Error('天气数据无效');
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: d.timezone }).format();
  } catch {
    throw new Error('天气时区无效');
  }
  return {
    weather: weatherFromCode(n.weather_code),
    temperature: n.temperature_2m,
    cloudCover: n.cloud_cover,
    windSpeed: n.wind_speed_10m,
    windDirection: n.wind_direction_10m,
    precipitation: n.precipitation,
    timestamp: n.time * 1000,
    timezone: d.timezone,
  };
}

export function weatherURL(location: WeatherLocation) {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(2),
    longitude: location.longitude.toFixed(2),
    current:
      'temperature_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
