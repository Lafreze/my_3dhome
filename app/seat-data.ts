import catalog from './seat-catalog.json';
import type { RoomId } from './house-data';
import type { Appearance } from './visitor-appearance';
export type Seat = {
  id: string;
  room: RoomId;
  name: string;
  offset: [number, number, number];
  yaw: number;
  kind?: 'bed';
};
export const seats = catalog as Seat[];
export const seatById = new Map(seats.map((seat) => [seat.id, seat]));
export type VisitorJourney = NonNullable<
  ReturnType<typeof import('./visitor-travel.mjs').createVisitorJourney>
>;
export type Visitor = {
  journey?: VisitorJourney;
  id: string;
  name: string;
  seatId: string;
  appearance?: Appearance;
  posture?: 'sit' | 'rest';
  gesture?: {
    id: string;
    kind: 'hello' | 'heart' | 'phone' | 'coffee';
    targetId?: string;
    at: number;
    expiresAt: number;
  };
};
export type Presence = {
  me: string;
  visitors: Visitor[];
  capacity: number;
  revision: number;
  serverTime?: number;
};
