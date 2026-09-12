import type { RoomId } from './house-data';

export function destinationThroughDoor(
  id: string,
  current: string,
): RoomId | undefined {
  const door = houseDoorLayout.find((d) => d.id === id || d.other === id);
  if (!door || door.rooms.length < 2) return;
  if (door.rooms.some((room) => room === current))
    return door.rooms.find((room) => room !== current);
  return id === door.other ? door.rooms[0] : door.rooms[1];
}

export type DoorStyle = 'reeded' | 'solid' | 'clear' | 'lattice';
export const houseDoorLayout = [
  {
    id: 'doorStudyLiving',
    x: 4,
    z: 1.75,
    yaw: Math.PI / 2,
    rooms: ['study', 'living'],
    style: 'reeded',
    side: 1,
  },
  {
    id: 'doorBedroomGallery',
    x: 4,
    z: 8.65,
    yaw: Math.PI / 2,
    rooms: ['bedroom', 'gallery'],
    style: 'solid',
    side: 1,
  },
  {
    id: 'doorStudyBedroom',
    x: 2.65,
    z: 3.4,
    yaw: 0,
    rooms: ['study', 'bedroom'],
    style: 'solid',
    side: -1,
  },
  {
    id: 'doorLivingGallery',
    x: 5.6,
    z: 3.4,
    yaw: 0,
    rooms: ['living', 'gallery'],
    style: 'clear',
    side: 1,
  },
  {
    id: 'doorBedroomCafe',
    x: 2.65,
    z: 10.2,
    yaw: 0,
    rooms: ['bedroom', 'cafe'],
    style: 'solid',
    side: -1,
  },
  {
    id: 'doorGalleryCafe',
    x: 9.6,
    z: 10.2,
    yaw: 0,
    rooms: ['gallery', 'cafe'],
    style: 'lattice',
    side: -1,
  },
  {
    id: 'galleryEastDoor',
    other: 'corridorGalleryDoor',
    x: 12,
    z: 9.2,
    yaw: Math.PI / 2,
    rooms: ['gallery', 'corridor'],
    style: 'clear',
    side: 1,
  },
  {
    id: 'cafeEastDoor',
    other: 'corridorCafeDoor',
    x: 12,
    z: 10.95,
    yaw: Math.PI / 2,
    rooms: ['cafe', 'corridor'],
    style: 'lattice',
    side: -1,
  },
  {
    id: 'libraryExitDoor',
    other: 'corridorLibraryDoor',
    x: 14,
    z: 1.75,
    yaw: Math.PI / 2,
    rooms: ['library', 'corridor'],
    style: 'reeded',
    side: 1,
  },
  {
    id: 'gameExitDoor',
    other: 'corridorGameDoor',
    x: 14,
    z: 9.2,
    yaw: Math.PI / 2,
    rooms: ['gaming', 'corridor'],
    style: 'lattice',
    side: 1,
  },
  {
    id: 'barExitDoor',
    other: 'corridorBarDoor',
    x: 14,
    z: 16.1,
    yaw: Math.PI / 2,
    rooms: ['bar', 'corridor'],
    style: 'reeded',
    side: 1,
  },
  {
    id: 'libraryGardenDoor',
    other: 'gardenLibraryDoor',
    x: 23,
    z: 2.15,
    yaw: Math.PI / 2,
    rooms: ['library', 'garden'],
    style: 'clear',
    side: 1,
  },
  {
    id: 'gameGardenDoor',
    other: 'gardenGameDoor',
    x: 23,
    z: 9.25,
    yaw: Math.PI / 2,
    rooms: ['gaming', 'garden'],
    style: 'clear',
    side: 1,
  },
  {
    id: 'barGardenDoor',
    other: 'gardenBarDoor',
    x: 23,
    z: 14.35,
    yaw: Math.PI / 2,
    rooms: ['bar', 'garden'],
    style: 'clear',
    side: -1,
  },
  {
    id: 'cafeEntranceDoor',
    x: 2.65,
    z: 18.1,
    yaw: 0,
    rooms: ['cafe'],
    style: 'lattice',
    side: 1,
  },
] satisfies {
  id: string;
  other?: string;
  x: number;
  z: number;
  yaw: number;
  rooms: RoomId[];
  style: DoorStyle;
  side: 1 | -1;
}[];
