import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, MeshStandardMaterial, Vector3, Mesh, Raycaster } from 'three';
import {
  houseDoorLayout,
  destinationThroughDoor,
} from '../app/house-door-layout.ts';
import { createInteriorDoor } from '../app/interior-doors.ts';
import { expansionPortals } from '../app/game-layout.ts';
import { rooms } from '../app/house-data.ts';
import { floorClear } from '../app/life-navigation.ts';

test('clicking every shared door enters the other room from either side', () => {
  for (const door of houseDoorLayout) {
    const [a, b] = door.rooms;
    if (!b) {
      assert.equal(destinationThroughDoor(door.id, a), undefined);
      continue;
    }
    assert.equal(destinationThroughDoor(door.id, a), b);
    assert.equal(destinationThroughDoor(door.id, b), a);
    if (door.other) {
      assert.equal(destinationThroughDoor(door.other, a), b);
      assert.equal(destinationThroughDoor(door.other, b), a);
    }
  }
  assert.equal(destinationThroughDoor('unknown', 'study'), undefined);
});

test('every room and expansion passage has one correctly aligned physical door', () => {
  for (const room of Object.keys(rooms))
    assert(
      houseDoorLayout.some((d) => d.rooms.includes(room)),
      room,
    );
  const centers = houseDoorLayout.map((d) => `${d.x}/${d.z}`);
  assert.equal(
    new Set(centers).size,
    centers.length,
    'Shared openings have one leaf, not overlapping doors',
  );
  for (const p of expansionPortals) {
    const matches = houseDoorLayout.filter(
      (d) => d.x === p.at && d.z === p.along,
    );
    assert.equal(matches.length, 1, `${p.a} / ${p.b}`);
    assert(matches[0].rooms.includes(p.a) && matches[0].rooms.includes(p.b));
    assert.equal(matches[0].yaw, Math.PI / 2);
  }
  for (const d of houseDoorLayout) {
    if (d.id === 'cafeEntranceDoor') continue;
    assert(floorClear([d.x, 0, d.z], 'resident'), d.id);
  }
});

test('doors open before a walker enters, hold for passage, and close after departure in both orientations', () => {
  for (const spec of houseDoorLayout) {
    const parent = new Group(),
      wood = new MeshStandardMaterial(),
      metal = new MeshStandardMaterial(),
      materials = [];
    parent.position.set(spec.x, 0, spec.z);
    parent.rotation.y = spec.yaw;
    const door = createInteriorDoor(parent, 0, wood, metal, materials, spec);
    const walker = new Vector3(
      spec.x + Math.cos(spec.yaw) * 2,
      0,
      spec.z - Math.sin(spec.yaw) * 2,
    );
    for (let i = 0; i < 60; i++) door.update(1 / 60, false, [walker]);
    assert(door.snapshot().opening > 0.99, spec.id);
    const leaf = door.root.getObjectByName('Independent pocket door leaf');
    parent.updateMatrixWorld(true);
    const ray = new Raycaster(
      parent.localToWorld(new Vector3(leaf.position.x, 0.5, 3)),
      new Vector3(0, 0, -1).transformDirection(parent.matrixWorld),
    );
    assert.equal(
      ray.intersectObject(leaf, true).length,
      0,
      'The clipped leaf cannot intercept clicks through the cutaway wall',
    );
    leaf.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      assert.equal(o.material.clippingPlanes.length, 2);
      const center = new Vector3(spec.x, 1, spec.z);
      assert(
        o.material.clippingPlanes.every((p) => p.distanceToPoint(center) > 0),
        'The visible door opening remains inside both clip planes',
      );
      const beyond = new Vector3(2, 1, 0);
      parent.localToWorld(beyond);
      assert(
        o.material.clippingPlanes.some((p) => p.distanceToPoint(beyond) < 0),
        'The moving leaf cannot protrude from the wall pocket',
      );
    });
    for (let i = 0; i < 100; i++) door.update(1 / 60, false, []);
    assert(
      door.snapshot().opening > 0.99,
      'Held while the character clears the frame',
    );
    for (let i = 0; i < 180; i++) door.update(1 / 60, false, []);
    assert(door.snapshot().opening < 0.001, 'Closes after the visitor leaves');
    parent.updateMatrixWorld(true);
    ray.ray.origin.copy(parent.localToWorld(new Vector3(0, 0.5, 3)));
    assert(
      ray.intersectObject(leaf, true).length > 0,
      'A closed door remains clickable',
    );
    door.toggle();
    door.update(1 / 60, true, []);
    assert.equal(door.snapshot().opening, 1);
    door.toggle();
    door.update(1 / 60, true, []);
    assert.equal(door.snapshot().opening, 0);
    door.openFor(4);
    door.update(1 / 60, true, []);
    assert.equal(door.snapshot().opening, 1);
    door.update(5, true, []);
    assert.equal(door.snapshot().opening, 0);
    parent.traverse((o) => o.geometry?.dispose());
    [wood, metal, ...materials].forEach((m) => m.dispose());
  }
});
