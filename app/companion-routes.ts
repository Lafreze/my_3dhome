import { navigationNodes, type Point } from './life-data';
import { floorClear, worldPoint } from './life-navigation';
export function companionDestinations(id: 'shiba' | 'capybara'): Point[] {
  // The café service counter and booth alcoves are closed to a puppy-sized body.
  return navigationNodes
    .filter((n) =>
      id === 'shiba'
        ? n.id.startsWith('cafe.aisle')
        : n.room === 'garden' && !n.seatId,
    )
    .map(worldPoint)
    .filter((p) => floorClear(p, id));
}
