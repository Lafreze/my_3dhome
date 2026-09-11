import * as T from 'three';
import type { RoomId } from './house-data';
import type { ObjectId } from './room-data';
import { houseFurniture } from './house-data';

export function addRoomNotes(k: {
  roots: Record<RoomId, T.Group>;
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  materials: T.Material[];
  textures: T.Texture[];
}) {
  // On existing surfaces: desk rear corner, coffee table, bedside cabinet,
  // gallery wall and café communal table. Nothing is placed in a walking aisle.
  const places: [ObjectId, RoomId, number, number, number, number][] = [
    ['studyNotes', 'study', 1.86, 1.278, -2.67, -0.14],
    [
      'livingNotes',
      'living',
      houseFurniture.living.table.x - 0.41,
      0.877,
      houseFurniture.living.table.z + 0.04,
      0.1,
    ],
    ['bedroomNotes', 'bedroom', 1.35, 0.74, -1.74, -0.12],
    ['galleryNotes', 'gallery', -3.875, 1.35, 1.1, 0],
    ['cafeNotes', 'cafe', 1.1, 1.218, 0.69, -0.18],
  ];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f2dda4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#8c7146';
  ctx.font = '23px sans-serif';
  ctx.fillText('留句话', 35, 67);
  ctx.strokeStyle = '#c9b683';
  ctx.lineWidth = 2;
  for (let y = 105; y < 215; y += 28) {
    ctx.beginPath();
    ctx.moveTo(35, y);
    ctx.lineTo(y === 189 ? 157 : 216, y);
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  k.textures.push(texture);
  const paper = new T.MeshStandardMaterial({
    map: texture,
    roughness: 0.95,
    side: T.DoubleSide,
  });
  const edge = new T.MeshStandardMaterial({
    color: '#e2cd95',
    roughness: 0.95,
  });
  k.materials.push(paper, edge);
  for (const [id, room, x, y, z, yaw] of places) {
    const group = new T.Group();
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    group.userData.id = id;
    if (id === 'galleryNotes') group.rotation.z = -Math.PI / 2;
    k.roots[room].add(group);
    // Paper belongs to its support, so a cutaway never leaves it floating alone.
    const support =
      id === 'studyNotes'
        ? k.groups.get('desk')
        : id === 'livingNotes'
          ? k.roots.living.children.find(
              (o) =>
                o !== group &&
                o.position.x === houseFurniture.living.table.x &&
                o.position.z === houseFurniture.living.table.z,
            )
          : undefined;
    if (support) {
      k.roots[room].updateWorldMatrix(true, true);
      support.attach(group);
    }
    k.groups.set(id, group);
    k.interactables.push(group);
    const base = new T.Mesh(new T.BoxGeometry(0.34, 0.006, 0.32), edge);
    group.add(base);
    const sheet = new T.Mesh(new T.PlaneGeometry(0.34, 0.32, 4, 4), paper);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.y = 0.004;
    const p = sheet.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++)
      p.setZ(i, Math.max(0, p.getX(i) - 0.1) ** 2 * 4);
    sheet.geometry.computeVertexNormals();
    group.add(sheet);
  }
}
