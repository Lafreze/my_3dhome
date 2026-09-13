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
};
export const exhibits: Exhibit[] = catalog;
export const exhibitObjects: Record<string, number> = {
  gallerySculpture: 0,
  galleryGame: 1,
  galleryCase: 2,
};
