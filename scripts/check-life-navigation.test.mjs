import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NavigationGraph,
  OccupancyManager,
  segmentClear,
} from '../app/life-navigation.ts';

test('a blocked nearest lattice point is bypassed without trapping the whole activity queue', () => {
  const graph = new NavigationGraph(),
    occupancy = new OccupancyManager();
  const start = [6.3, 0.085, 4.3],
    destination = [9.6, 0.085, 9.25];
  occupancy.actors.set('robot', {
    position: [6.624540584539819, 0.085, 4.804540584539819],
    radius: 0.25,
    active: true,
  });
  assert(!occupancy.clear([6.3, 0.085, 4.34], 'cat'));
  const path = graph.path(start, destination, 'cat', occupancy);
  assert(path, 'The open side remains reachable');
  let previous = start;
  for (const next of path) {
    assert(segmentClear(previous, next, 'cat'));
    assert(
      graph.segmentFree(previous, next, 'cat', occupancy),
      'Every connecting segment uses the same clearance as walking',
    );
    previous = next;
  }
  assert.deepEqual(previous, destination);
});
