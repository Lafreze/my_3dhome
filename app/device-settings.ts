export const tvSettingsKey = 'satori-tv-v1';
export const computerSettingsKey = 'satori-computer-v1';
export function websiteURL(input: string): string | null {
  try {
    const url = new URL(input.trim());
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function readDevice(
  key: string,
): { url: string; enabled: boolean } | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value &&
      typeof value.url === 'string' &&
      typeof value.enabled === 'boolean'
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveDevice(key: string, url: string, enabled: boolean) {
  localStorage.setItem(key, JSON.stringify({ url, enabled }));
}
