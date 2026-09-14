import { seatById } from './seat-data';

export const chairSources = {
  'oak-armchair': {
    width: 0.8203444,
    depth: 0.9865617,
    seatY: 0.54072,
    seatZ: 0.05,
  },
  'tufted-dining': {
    width: 0.4335708,
    depth: 0.5764201,
    seatY: 0.45402,
    seatZ: 0.035,
  },
  'mid-century-lounge': {
    width: 1.0086144,
    depth: 1.1903108,
    seatY: 0.44528,
    seatZ: 0.17,
  },
} as const;
export type ChairModel = keyof typeof chairSources;
export type DesignerChair = {
  seat: string;
  model: ChairModel;
  width: number;
  depth: number;
  upholstery?: string;
};
export const designerChairs: DesignerChair[] = [
  { seat: 'study-work', model: 'tufted-dining', width: 0.75, depth: 0.76 },
  {
    seat: 'study-reading',
    model: 'oak-armchair',
    width: 1.12,
    depth: 1.1,
    upholstery: '#a86e48',
  },
  {
    seat: 'bedroom-reading',
    model: 'oak-armchair',
    width: 1.06,
    depth: 1.04,
    upholstery: '#d9cebc',
  },
  { seat: 'library-desk', model: 'tufted-dining', width: 0.78, depth: 0.74 },
  {
    seat: 'library-armchair',
    model: 'mid-century-lounge',
    width: 1.22,
    depth: 1.2,
  },
  ...Array.from(
    { length: 9 },
    (_, i): DesignerChair => ({
      seat: `cafe-chair-${i + 1}`,
      model: i < 7 ? 'tufted-dining' : 'mid-century-lounge',
      width: i < 7 ? 0.72 : 1.12,
      depth: i < 7 ? 0.72 : 1.13,
    }),
  ),
];
/** Authored chairs face +Z. Align their measured cushion point to the existing anchor. */
export function chairPlacement(chair: DesignerChair) {
  const source = chairSources[chair.model],
    seat = seatById.get(chair.seat)!;
  const scale = [
    chair.width / source.width,
    (seat.offset[1] - 0.085) / source.seatY,
    chair.depth / source.depth,
  ] as const;
  return {
    scale,
    yaw: seat.yaw,
    position: [
      seat.offset[0] - Math.sin(seat.yaw) * source.seatZ * scale[2],
      0.085,
      seat.offset[2] - Math.cos(seat.yaw) * source.seatZ * scale[2],
    ] as const,
  };
}

/** Keep the recliner shell proportional; extend its pedestal to the house's seat height. */
export function loungeHeight(chair: DesignerChair, y: number) {
  const { scale } = chairPlacement(chair),
    source = chairSources[chair.model];
  const shellScale = Math.min(scale[0], scale[2]) * 1.12;
  const lift = source.seatY * (scale[1] - shellScale);
  const pivot = 0.28;
  return {
    y: (y * shellScale + lift * Math.min(Math.max(y / pivot, 0), 1)) / scale[1],
    slope: (shellScale + (y > 0 && y < pivot ? lift / pivot : 0)) / scale[1],
  };
}
