import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companionDestinations } from '../app/companion-routes.ts';
import {
  NavigationGraph,
  OccupancyManager,
  walkingStepClear,
} from '../app/life-navigation.ts';
import rigs from '../config/character-rigs.json' with { type: 'json' };
for (const [id] of [
  ['shiba', 'cafe'],
  ['capybara', 'garden'],
])
  void test(`${id}: fitted body fits every selected route and yields to occupied space`, () => {
    const goals = companionDestinations(id);
    assert.ok(goals.length >= 2);
    const graph = new NavigationGraph(),
      occupancy = new OccupancyManager();
    let routes = 0;
    for (const from of goals)
      for (const to of goals) {
        if (from === to) continue;
        const path = graph.path(from, to, id, occupancy);
        assert.ok(path, `${id} has an isolated destination`);
        routes++;
        let previous = from;
        for (const p of path) {
          assert.ok(walkingStepClear(previous, p, id));
          previous = p;
        }
      }
    assert.ok(routes >= 2);
    occupancy.actors.set(id, {
      position: goals[0],
      radius: rigs[id].radius,
      active: true,
    });
    assert.equal(occupancy.clear(goals[0], 'resident'), false);
    const second = id === 'shiba' ? 'capybara' : 'shiba';
    occupancy.actors.set(second, {
      position: goals[0],
      radius: rigs[second].radius,
      active: true,
    });
    assert.equal(occupancy.clear(goals[0], id), false);
  });
