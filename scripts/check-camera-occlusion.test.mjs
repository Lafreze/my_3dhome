import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createCameraOcclusion } from '../app/camera-occlusion.ts';
void test('foreground furniture disappears, anchors survive, and visibility restores', () => {
  const scene = new T.Scene(),
    tv = new T.Group(),
    anchor = new T.Group();
  tv.add(anchor);
  const shell = new T.Mesh(
    new T.BoxGeometry(3, 2, 0.2),
    new T.MeshBasicMaterial(),
  );
  tv.add(shell);
  scene.add(tv);
  const camera = new T.PerspectiveCamera();
  camera.position.set(0, 0, 3);
  scene.updateMatrixWorld(true);
  const occlusion = createCameraOcclusion(new Map([['television', tv]]));
  occlusion.update(camera, new T.Vector3(0, 0, -2), 1);
  assert(!shell.visible);
  assert(tv.visible && anchor.visible);
  occlusion.restore();
  assert(shell.visible);
  camera.position.set(4, 0, 3);
  occlusion.update(camera, new T.Vector3(4, 0, -2), 2);
  assert(shell.visible);
  camera.position.set(0, 0, 3);
  occlusion.update(camera, new T.Vector3(0, 0, -2), 3, 'television');
  assert(shell.visible);
  occlusion.update(camera, new T.Vector3(0, 0, 0), 4);
  assert(shell.visible);
  occlusion.dispose();
  shell.geometry.dispose();
  shell.material.dispose();
});
