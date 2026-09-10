import type { ActorState } from './life-data';

export const residentRoutines = {
  work: ['study.desk', 'study.chair', 'study.bookshelf'],
  coffee: ['cafe.barInside', 'cafe.cups', 'cafe.pickup', 'cafe.window'],
  unwind: ['living.sofa', 'living.recordPlayer', 'study.chair'],
  gallery: [
    'gallery.bench',
    'gallery.leftPlinth',
    'gallery.centerPlinth',
    'gallery.rightPlinth',
  ],
} as const;
export type ResidentRoutine = keyof typeof residentRoutines;
export const quietPoses = (node: string): ActorState[] =>
  node.includes('recordPlayer') || node === 'living.sofa'
    ? ['listenMusic', 'think']
    : node.includes('window')
      ? ['lookOutside', 'think']
      : node.startsWith('gallery.')
        ? ['inspectArtwork', 'think']
        : ['think', 'stretch'];
export const momentRules = {
  residentQuiet: { chance: 0.42, duration: 8, cooldown: 70 },
  coffeeAroma: { chance: 0.32, duration: 8, cooldown: 95 },
  windowMotes: { chance: 0.28, duration: 9, cooldown: 120 },
};
