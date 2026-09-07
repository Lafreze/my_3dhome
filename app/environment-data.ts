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
] as const;
export type TimeOfDay = (typeof times)[number]['id'];
export type Weather = (typeof weathers)[number]['id'];
export type Environment = { time: TimeOfDay; weather: Weather };
