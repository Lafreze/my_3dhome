'use client';
import { uploadModelFile } from './model-upload-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import defaults from '../config/house-defaults.json';
import type { Profile } from './room-data';
import type { Exhibit } from './exhibit-data';
export type Appearance = Record<
  keyof typeof defaults.appearance,
  number | string
>;
export type Device = { url: string; enabled: boolean };
export type HouseSettings = {
  profile: Profile;
  note: string;
  appearance: Appearance;
  devices: { computer: Device; tv: Device };
  wallArt: Record<string, string>;
};
export type HousePatch = Partial<
  Omit<HouseSettings, 'appearance' | 'devices' | 'wallArt'>
> & {
  appearance?: Partial<Appearance>;
  devices?: Partial<HouseSettings['devices']>;
  wallArt?: Record<string, string | null>;
};
type Snapshot = { revision: number; settings: HouseSettings };
type Studio = Snapshot & {
  admin: boolean;
  ready: boolean;
  error: string;
  login: (passphrase: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  uploadModel: (
    file: File,
    metadata: {
      title: string;
      description: string;
      visibility: 'public' | 'private';
      compress: boolean;
    },
    onProgress?: (message: string) => void,
  ) => Promise<Exhibit>;
  resetModelShare: (id: string) => Promise<Exhibit>;
  deleteModel: (
    id: string,
  ) => Promise<{ id: string; deleted: boolean; cleanupPending: boolean }>;
  save: (patch: HousePatch, revision?: number) => Promise<void>;
};
const Context = createContext<Studio | null>(null);
export const appearanceLabels: Record<keyof Appearance, string> = {
  bed: '书房沙发',
  chair: '阅读椅',
  rug: '书房地毯',
  livingSofa: '客厅沙发',
  sleepBed: '卧室床品',
  controller: '游戏手柄',
};
export const appearanceColors: Record<keyof Appearance, string[]> = {
  bed: ['#74856b', '#b8816b', '#7b91a2'],
  chair: ['#cf966a', '#7f9479', '#9d8287'],
  rug: ['#e5d8b8', '#b1bdac', '#d7bda4'],
  livingSofa: ['#d4c9b7', '#b7836e', '#7b929a'],
  sleepBed: ['#8495a6', '#e1c7b3', '#c7d2d3'],
  controller: ['#d0c8b2', '#899d93', '#bf8d7e'],
};
export function appearanceColor(
  id: keyof Appearance,
  value: Appearance[keyof Appearance],
): string {
  return typeof value === 'string'
    ? value
    : appearanceColors[id][value] || appearanceColors[id][0];
}
export function StudioProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
      revision: -1,
      settings: defaults,
    }),
    [admin, setAdmin] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const current = useRef(snapshot),
    csrf = useRef('');
  const accept = useCallback((next: Snapshot) => {
    if (next.revision > current.current.revision) {
      current.current = next;
      setSnapshot(next);
    }
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/house', {
      cache: 'no-store',
      headers:
        current.current.revision >= 0
          ? { 'If-None-Match': `"house-r${current.current.revision}"` }
          : {},
    });
    if (response.status === 304) {
      setReady(true);
      setError('');
      return;
    }
    if (!response.ok) throw Error('暂时无法读取已保存的小屋设置。');
    accept(await response.json());
    setReady(true);
    setError('');
  }, [accept]);
  useEffect(() => {
    let live = true;
    const update = () => {
      if (document.hidden) return;
      void refresh().catch((e) => {
        if (live) setError(e.message);
      });
    };
    update();
    void fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s) => {
        if (live) {
          csrf.current = s.csrf || '';
          setAdmin(s.authenticated === true);
        }
      })
      .catch(() => {});
    const timer = setInterval(update, 15000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  const request = async (
    url: string,
    body: unknown,
    method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  ) => {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Studio-CSRF': csrf.current,
      },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        setAdmin(false);
        csrf.current = '';
      }
      if (response.status === 409) await refresh();
      throw Error(value.error || '保存失败，请重试。');
    }
    return value;
  };
  const login = async (passphrase: string) => {
    const s = await request('/api/admin/login', { passphrase });
    csrf.current = s.csrf;
    setAdmin(true);
    await refresh();
  };
  const logout = async () => {
    await request('/api/admin/logout', {});
    csrf.current = '';
    setAdmin(false);
  };
  const deleteNote = async (id: string) => {
    await request('/api/notes', { id }, 'DELETE');
  };
  const uploadModel = async (
    file: File,
    metadata: {
      title: string;
      description: string;
      visibility: 'public' | 'private';
      compress: boolean;
    },
    onProgress?: (message: string) => void,
  ) => {
    if (!admin) throw Error('请先进入管理模式。');
    if (file.size > 200 * 1024 * 1024) throw Error('模型不能超过 200 MB。');
    return uploadModelFile(
      file,
      metadata,
      request,
      () => csrf.current,
      onProgress,
    );
  };

  const save = async (
    patch: HousePatch,
    revision = current.current.revision,
  ) => {
    if (!admin) throw Error('当前无法保存。');
    accept(await request('/api/house', { revision, patch }, 'PATCH'));
  };
  return (
    <Context.Provider
      value={{
        ...snapshot,
        admin,
        ready,
        error,
        login,
        logout,
        save,
        deleteNote,
        uploadModel,
        resetModelShare: (id) =>
          request('/api/admin/models/reset-share', { id }),
        deleteModel: (id) => request('/api/admin/models', { id }, 'DELETE'),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStudio() {
  const context = useContext(Context);
  if (!context) throw Error('Missing StudioProvider');
  return context;
}
