import * as T from 'three';
import type { RoomId } from './house-data';
import { rooms } from './house-data';

/** A short, scheduled cluster of drifting dust; it adds no lights or sun animation. */
export function createWindowMotes() {
  const count = 14,
    positions = new Float32Array(count * 3);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d')!,
    gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(1, '#fff0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 16);
  const map = new T.CanvasTexture(canvas);
  const material = new T.PointsMaterial({
    map,
    color: '#ffe3b7',
    size: 0.025,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const root = new T.Points(geometry, material);
  root.name = 'life/window-motes';
  root.frustumCulled = false;
  root.visible = false;
  root.raycast = () => {};
  let elapsed = 10,
    phase = 0,
    room: RoomId = 'study';
  return {
    root,
    start(nextRoom: RoomId, seed: number) {
      room = nextRoom;
      elapsed = 0;
      phase = seed * 6;
      const r = rooms[room];
      root.position.set(
        r.x + (room === 'bedroom' ? -2.8 : room === 'cafe' ? 5.2 : -0.8),
        1.8,
        r.z + (room === 'cafe' ? 3 : -2.5),
      );
    },
    update(dt: number, reduced: boolean, visible: (room: RoomId) => boolean) {
      if (reduced) elapsed = 10;
      root.visible = elapsed < 9 && visible(room);
      if (elapsed >= 9) return;
      elapsed += dt;
      material.opacity = Math.sin(Math.min(1, elapsed / 9) * Math.PI) * 0.48;
      for (let i = 0; i < count; i++) {
        positions[i * 3] = Math.sin(i * 2.399 + phase) * 0.55 + elapsed * 0.035;
        positions[i * 3 + 1] =
          (i / count - 0.5) * 0.8 + Math.sin(elapsed * 0.55 + i) * 0.055;
        positions[i * 3 + 2] =
          Math.cos(i * 1.27 + phase + elapsed * 0.11) * 0.22;
      }
      geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
      root.removeFromParent();
    },
  };
}
