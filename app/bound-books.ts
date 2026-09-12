import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSpineAtlas, bindingColors, spineSubjects } from './book-spines';

/** Separate boards, rounded spines, recessed paper edges and headbands, batched per book. */
export function boundBooks(materials: T.Material[], textures: T.Texture[]) {
  const spine = createSpineAtlas(textures, materials);
  const make = (color: string, roughness = 0.8) => {
    const m = new T.MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  };
  const bindings = bindingColors.map((c) => make(c)),
    gold = make('#b89e68', 0.43),
    ribbon = make('#ac775e');
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#e6dcc3';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 256; i += 3) {
    ctx.fillStyle = i % 9 ? '#b9ad9430' : '#9a8b6d50';
    ctx.fillRect(i, 0, 1, 128);
  }
  const edges = new T.CanvasTexture(cv);
  edges.colorSpace = T.SRGBColorSpace;
  edges.anisotropy = 4;
  textures.push(edges);
  const pages = make('#fff8df');
  pages.map = edges;
  const paper = make('#efe7d4');
  const mesh = (
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const box = (
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.005,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
      m,
      x,
      y,
      z,
    );
  const coverTextures = new Map<number, T.MeshStandardMaterial>();
  function coverArt(index: number) {
    if (coverTextures.has(index)) return coverTextures.get(index)!;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 384;
    const q = c.getContext('2d')!;
    q.fillStyle = bindingColors[index % bindings.length];
    q.fillRect(0, 0, 256, 384);
    q.strokeStyle = '#c2af7d';
    q.lineWidth = 2;
    q.strokeRect(19, 19, 218, 346);
    q.fillStyle = '#f0e1ba';
    q.font = '20px serif';
    q.textAlign = 'center';
    q.fillText(spineSubjects[index % spineSubjects.length], 128, 79);
    q.font = '10px monospace';
    q.fillText(
      `STUDY EDITION  ${String(index + 1).padStart(2, '0')}`,
      128,
      325,
    );
    // Covers use different compositions: architectural lines, botanical stems and lunar discs.
    if (index % 3 === 0) {
      for (let i = 0; i < 5; i++) {
        q.strokeRect(59 + i * 18, 135 + i * 12, 104 - i * 13, 128 - i * 8);
      }
    } else if (index % 3 === 1) {
      q.beginPath();
      q.moveTo(128, 272);
      q.quadraticCurveTo(97, 195, 143, 130);
      q.stroke();
      for (let i = 0; i < 5; i++) {
        q.beginPath();
        q.ellipse(
          118 + (i % 2 ? 24 : -18),
          153 + i * 24,
          20,
          7,
          i % 2 ? -0.65 : 0.65,
          0,
          Math.PI * 2,
        );
        q.stroke();
      }
    } else {
      q.beginPath();
      q.arc(128, 201, 48, 0, Math.PI * 2);
      q.stroke();
      for (let i = 0; i < 13; i++) {
        q.fillRect(50 + ((i * 37) % 152), 120 + ((i * 53) % 160), 2, 2);
      }
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    textures.push(tex);
    const m = make('#ffffff');
    m.map = tex;
    coverTextures.set(index, m);
    return m;
  }
  function upright(
    parent: T.Object3D,
    w: number,
    h: number,
    d: number,
    index: number,
  ) {
    const g = new T.Group();
    g.name = `Bound volume / ${spineSubjects[index % spineSubjects.length]}`;
    g.userData.boundBook = index;
    parent.add(g);
    const cover = bindings[index % bindings.length],
      board = Math.min(0.012, w * 0.13);
    box(g, w - board * 2, h - 0.026, d - 0.035, 0, h / 2, -0.008, pages, 0.007);
    for (const side of [-1, 1]) {
      box(g, board, h, d, (side * (w - board)) / 2, h / 2, 0, cover);
      // Turned-in cloth and pale endpapers remain visible beside the page block.
      box(
        g,
        0.002,
        h - 0.018,
        d - 0.032,
        side * (w / 2 - board - 0.001),
        h / 2,
        -0.006,
        paper,
        0.0005,
      );
    }
    box(g, w, h, 0.052, 0, h / 2, d / 2 - 0.015, cover, Math.min(0.023, w / 3));
    mesh(
      g,
      spine.geometry(w * 0.83, h * 0.88, index + 144),
      spine.material,
      0,
      h / 2,
      d / 2 + 0.013,
    );
    for (const y of [0.04, h - 0.04])
      box(g, w * 0.87, 0.009, 0.006, 0, y, d / 2 + 0.015, gold, 0.002);
    for (const y of [0.018, h - 0.018]) {
      box(g, w * 0.64, 0.009, 0.035, 0, y, d / 2 - 0.035, paper, 0.002);
      for (let i = 0; i < 4; i++)
        box(
          g,
          0.005,
          0.01,
          0.025,
          (i - 1.5) * w * 0.15,
          y,
          d / 2 - 0.029,
          cover,
          0.001,
        );
    }
    if (index % 4 === 0) {
      const tag = box(
        g,
        0.018,
        0.072,
        0.003,
        w * 0.13,
        h + 0.018,
        -d * 0.18,
        ribbon,
        0.001,
      );
      tag.rotation.z = 0.09;
    }
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of g.children)
      if (o instanceof T.Mesh && !Array.isArray(o.material)) {
        const list = bins.get(o.material) || [];
        list.push(o);
        bins.set(o.material, list);
      }
    for (const [m, list] of bins) {
      if (list.length < 2) continue;
      const gs = list.map((o) => {
        o.updateMatrix();
        return (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
      });
      const geo = mergeGeometries(gs);
      gs.forEach((x) => x.dispose());
      if (geo) {
        mesh(g, geo, m, 0, 0, 0);
        list.forEach((o) => {
          g.remove(o);
          o.geometry.dispose();
        });
      }
    }
    return g;
  }
  function flat(
    parent: T.Object3D,
    w: number,
    d: number,
    h: number,
    index: number,
  ) {
    const base = new T.Group();
    parent.add(base);
    const body = upright(base, h, w, d, index);
    body.rotation.z = -Math.PI / 2;
    body.position.set(-w / 2, h / 2, 0);
    const cover = mesh(
      base,
      new T.PlaneGeometry(w - 0.016, d - 0.016),
      coverArt(index),
      0,
      h + 0.001,
      0,
    );
    cover.rotation.x = -Math.PI / 2;
    return base;
  }
  return { upright, flat };
}
