export const times = [
  { id: 'morning', label: '清晨' },
  { id: 'afternoon', label: '午后' },
  { id: 'sunset', label: '黄昏' },
  { id: 'night', label: '夜晚' },
] as const;
export const weathers = [
  { id: 'clear', label: '晴天' },
  { id: 'cloudy', label: '阴天' },
  { id: 'rain', label: '雨天' },
  { id: 'snow', label: '下雪' },
  { id: 'fog', label: '薄雾' },
  { id: 'storm', label: '雷雨' },
] as const;
export type TimeOfDay = (typeof times)[number]['id'];
export type Weather = (typeof weathers)[number]['id'];
export type SolarPosition = { altitude: number; azimuth: number };
export type Environment = {
  time: TimeOfDay;
  weather: Weather;
  solar?: SolarPosition;
  cloudCover?: number;
  windSpeed?: number;
  windDirection?: number;
  precipitation?: number;
};

export const previewSun: Record<TimeOfDay, SolarPosition> = {
  morning: { altitude: 16, azimuth: 95 },
  afternoon: { altitude: 48, azimuth: 205 },
  sunset: { altitude: 4, azimuth: 265 },
  night: { altitude: -25, azimuth: 0 },
};
export function sunFor(value: Environment) {
  return value.solar ?? previewSun[value.time];
}
