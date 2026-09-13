import catalog from '../config/exhibit-catalog.json';

export type Exhibit = {
  id: string;
  title: string;
  category: string;
  description: string;
  sourceName?: string;
  assetId?: string;
  roomAssetId?: string;
  thumbnail?: string;
  accent?: string;
  url?: string;
  bytes?: number;
  createdAt?: string;
  visibility?: 'public' | 'private';
  sharePath?: string;
  originalBytes?: number;
  compression?: 'original' | 'compressed' | 'already-optimized' | 'fallback';
  storage?: 'local' | 'r2';
};
export const exhibits: Exhibit[] = catalog;
export const exhibitObjects: Record<string, number> = {
  gallerySculpture: 0,
  galleryGame: 1,
  galleryCase: 2,
};
