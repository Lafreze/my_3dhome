import * as T from 'three';
import { makeSurface } from './house-finishes';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ObjectId } from './room-data';
import type { HouseView } from './house-data';
import { collectionCards, type CollectionData } from './life-data';
import { createCollectionStore } from './life-collections';

/** Small hand-made objects; each animation is driven by the house's existing clock. */
export function createQuietObjects(o: {
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  materials: T.Material[];
  textures: T.Texture[];
  camera: T.Camera;
  audio: () => AudioContext | null;
  bubble: (text: string) => void;
  collect: (data: CollectionData, message: string) => void;
  moment: () => void;
  bellReply: () => boolean;
}) {
  const material = (color: string, roughness: number, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    o.materials.push(m);
    return m;
  };
  const linen = material('#777d65', 0.93),
    paper = material('#efe6d3', 0.97),
    ink = material('#657251', 0.87),
    ribbon = material('#a96850', 0.88),
    brass = material('#bc9c67', 0.36, 0.72),
    enamel = material('#354a41', 0.38),
    rubber = material('#373a35', 0.96);
  Object.assign(linen, makeSurface('cotton', o.textures));
  const brushed = makeSurface('brushed-metal', o.textures);
  brass.bumpMap = brushed.bumpMap;
  brass.bumpScale = brushed.bumpScale;
  brass.roughnessMap = brushed.roughnessMap;
  const add = (
    parent: T.Object3D,
    geometry: T.BufferGeometry,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (
    parent: T.Object3D,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) =>
    add(
      parent,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.006, h / 3)),
      mat,
      x,
      y,
      z,
    );
  const register = (id: ObjectId, parent: T.Group, position: number[]) => {
    const group = new T.Group();
    group.name = id;
    group.userData.id = id;
    group.position.fromArray(position);
    parent.add(group);
    o.groups.set(id, group);
    o.interactables.push(group);
    return group;
  };
  function print(postcard: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 512;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#eee5d3';
    c.fillRect(0, 0, 384, 512);
    c.strokeStyle = '#c1b59c';
    c.lineWidth = 1;
    for (let y = 190; y < 472; y += 27) {
      c.beginPath();
      c.moveTo(36, y);
      c.lineTo(348, y);
      c.stroke();
    }
    c.fillStyle = '#566653';
    c.font = '17px Georgia';
    c.fillText(postcard ? 'A QUIET AFTERNOON' : 'THINGS WORTH KEEPING', 35, 53);
    c.font = 'italic 12px Georgia';
    c.fillText('kuro.cafe / field notes', 36, 80);
    // A restrained architectural study and an ochre sun, drawn for this object.
    c.strokeStyle = '#776f60';
    c.lineWidth = 3;
    c.strokeRect(58, 115, 268, 232);
    c.beginPath();
    c.moveTo(58, 270);
    c.lineTo(125, 216);
    c.lineTo(177, 248);
    c.lineTo(247, 187);
    c.lineTo(326, 274);
    c.stroke();
    c.fillStyle = '#c9a369';
    c.beginPath();
    c.arc(246, 161, 21, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#a5644b';
    c.fillRect(275, 389, 47, 57);
    c.fillStyle = '#ede3cf';
    c.font = '18px Georgia';
    c.fillText('K', 292, 422);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    o.textures.push(texture);
    const mat = material('#ffffff', 0.98);
    mat.map = texture;
    return mat;
  }
  const desk = o.groups.get('desk')!;
  const journal = register('deskJournal', desk, [0.67, 1.27, -0.24]);
  journal.rotation.y = -0.12;
  box(journal, 0.3, 0.009, 0.38, linen, 0, 0.005);
  box(journal, 0.28, 0.025, 0.36, paper, 0.003, 0.02);
  // A few real page edges; no dense stripes and no permanently moving empty fabric.
  for (let i = 0; i < 3; i++)
    box(journal, 0.282, 0.001, 0.36, paper, 0.002, 0.013 + i * 0.007);
  const page = add(
    journal,
    new T.PlaneGeometry(0.273, 0.35),
    print(false),
    0.004,
    0.034,
  );
  page.rotation.x = -Math.PI / 2;
  const cover = new T.Group();
  cover.position.set(-0.145, 0.038, 0);
  journal.add(cover);
  box(cover, 0.3, 0.009, 0.38, linen, 0.145);
  box(cover, 0.27, 0.001, 0.35, paper, 0.145, -0.005);
  box(cover, 0.1, 0.001, 0.15, paper, 0.145, 0.005);
  for (let i = 0; i < 3; i++)
    box(
      cover,
      0.068 - i * 0.012,
      0.001,
      0.003,
      ink,
      0.145,
      0.006,
      -0.035 + i * 0.025,
    );
  box(journal, 0.014, 0.002, 0.12, ribbon, 0.083, 0.036, 0.16);
  // Pressed stem and leaves sit between the actual pages and cover.
  const stem = add(
    journal,
    new T.CylinderGeometry(0.0013, 0.0013, 0.16, 5),
    ink,
    -0.064,
    0.035,
    0.052,
  );
  stem.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const leaf = add(
      journal,
      new T.SphereGeometry(1, 10, 6),
      ink,
      -0.064 + (i % 2 ? -0.015 : 0.015),
      0.036,
      -0.005 + i * 0.032,
    );
    leaf.scale.set(0.018, 0.0013, 0.026);
    leaf.rotation.y = i % 2 ? -0.5 : 0.5;
  }
  const drawer = o.groups.get('drawer')!;
  const card = new T.Group();
  card.position.set(-0.025, -0.009, 0.09);
  card.rotation.y = 0.14;
  drawer.add(card);
  box(card, 0.29, 0.004, 0.34, paper);
  const face = add(card, new T.PlaneGeometry(0.283, 0.333, 1, 12), print(true));
  const positions = face.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++)
    positions.setZ(
      i,
      0.003 + Math.pow(Math.max(0, positions.getY(i) - 0.085), 2) * 1.2,
    );
  face.geometry.computeVertexNormals();
  face.rotation.x = -Math.PI / 2;
  const cafe = o.groups.get('cafeEspresso')!.parent as T.Group;
  const bell = register('cafeBell', cafe, [-3.66, 1.551, -0.61]);
  add(bell, new T.CylinderGeometry(0.101, 0.104, 0.016, 32), rubber, 0, 0.008);
  add(
    bell,
    new T.LatheGeometry(
      [
        [0, 0.013],
        [0.1, 0.013],
        [0.105, 0.025],
        [0.097, 0.038],
        [0.091, 0.04],
        [0, 0.04],
      ].map((p) => new T.Vector2(...(p as [number, number]))),
      40,
    ),
    enamel,
  );
  add(
    bell,
    new T.LatheGeometry(
      [
        [0.086, 0.04],
        [0.087, 0.053],
        [0.079, 0.09],
        [0.055, 0.122],
        [0.022, 0.135],
        [0.009, 0.135],
      ].map((p) => new T.Vector2(...(p as [number, number]))),
      40,
    ),
    brass,
  );
  const button = new T.Group();
  bell.add(button);
  add(button, new T.CylinderGeometry(0.007, 0.007, 0.035, 12), brass, 0, 0.141);
  add(button, new T.SphereGeometry(1, 20, 10), brass, 0, 0.161).scale.set(
    0.024,
    0.008,
    0.024,
  );
  const sounds = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  function ding() {
    const audio = o.audio();
    if (!audio || audio.state !== 'running') return;
    const distance = bell
      .getWorldPosition(new T.Vector3())
      .distanceTo(o.camera.position);
    for (const frequency of [1175, 2798]) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      const sound = { oscillator, gain };
      sounds.add(sound);
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.018 / (1 + (distance * distance) / 25),
        audio.currentTime + 0.007,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.8);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        sounds.delete(sound);
      };
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.85);
    }
  }
  const store = createCollectionStore((id, data, saved) =>
    o.collect(
      data,
      `发现「${collectionCards[id].title}」${saved ? '' : ' · 本次访问可查看'}`,
    ),
  );
  let clock = 0,
    open = false,
    angle = 0,
    bellAt = -100,
    drawerAt = -100,
    journalReady = false;
  return {
    interact(id: ObjectId, drawerOpen = false) {
      if (id === 'deskJournal') {
        if (Math.abs(angle - (open ? 2.82 : 0)) > 0.03) return;
        open = !open;
        journalReady = false;
        o.moment();
      }
      if (id === 'cafeBell' && clock - bellAt > 8) {
        bellAt = clock;
        ding();
        if (!o.bellReply()) o.bubble('叮。把匆忙留在门外。');
        o.moment();
      }
      if (id === 'drawer') {
        drawerAt = drawerOpen ? clock : -100;
        if (drawerOpen) o.moment();
      }
    },
    update(dt: number, paused: boolean, reduced: boolean, view: HouseView) {
      if (paused) return;
      clock += dt;
      if (view === 'study' || view === 'overview') {
        angle = T.MathUtils.damp(angle, open ? 2.82 : 0, 4.5, dt);
        if (reduced) angle = open ? 2.82 : 0;
        cover.rotation.z = angle;
        if (open && !journalReady && Math.abs(angle - 2.82) < 0.035) {
          journalReady = true;
          if (!store.collect('story.pressedLeaf', 'house', 'study'))
            o.bubble('一片压平的叶子，夹着还没写完的想法。');
        }
        if (clock - drawerAt > 0.8 && drawerAt > -100) {
          drawerAt = -100;
          store.collect('story.drawer', 'house', 'study');
        }
      }
      const age = clock - bellAt;
      button.position.y =
        reduced || age > 0.8
          ? 0
          : -0.012 * Math.exp(-age * 7) * Math.sin(age * 22);
    },
    snapshot: () => ({ open, angle, bellAt, clock, sounds: sounds.size }),
    dispose() {
      sounds.forEach((s) => {
        s.oscillator.onended = null;
        s.oscillator.stop();
        s.oscillator.disconnect();
        s.gain.disconnect();
      });
      sounds.clear();
    },
  };
}
