import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ObjectId, Project } from './room-data';
import { exhibits, exhibitObjects } from './exhibit-data';
import { galleryPlinths, galleryCabinet } from './gallery-layout';
import { fitTimberGrain, interiorMaterial } from './house-finishes';
import {
  loadAssetGltf,
  releaseAssetTexture,
  type RoomAssets,
} from './asset-loading';
import type { WallCutaways } from './wall-cutaway';

export const galleryProjectIndex = exhibitObjects;

type Kit = {
  root: T.Group;
  materials: T.Material[];
  textures: T.Texture[];
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  oak: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
  assets: RoomAssets;
  cutaways: WallCutaways;
  onReady: () => void;
};

/** Three supplied sculptures and a shallow, wall-mounted collection cabinet. */
export function createProjectGallery(k: Kit) {
  let disposed = false,
    focus: ObjectId | null = null;
  const geometry = new Set<T.BufferGeometry>(),
    modelMaterials = new Set<T.Material>(),
    modelTextures = new Set<T.Texture>();
  const material = (color: string, roughness = 0.65, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    m.userData.live = true;
    k.materials.push(m);
    return m;
  };
  const limestone = interiorMaterial(
      'travertine',
      '#bcb5a7',
      k.materials,
      k.textures,
    ),
    walnut = interiorMaterial('walnut', '#57473e', k.materials, k.textures),
    ink = material('#303330', 0.48, 0.12),
    bronze = interiorMaterial(
      'brushed-metal',
      '#b4a28b',
      k.materials,
      k.textures,
    );
  limestone.name = 'Gallery / honed warm-grey limestone';
  limestone.bumpScale = 0.0012;
  limestone.roughness = 0.62;
  walnut.name = 'Gallery / smoked walnut veneer';
  bronze.roughness = 0.44;
  const glass = material('#d7e5e2', 0.14, 0.05);
  glass.transparent = true;
  glass.opacity = 0.11;
  glass.depthWrite = false;
  const glow = material('#fff0cf');
  glow.emissive.set('#ffe0a8');
  glow.emissiveIntensity = 0.6;
  const mesh = (
    p: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    fitTimberGrain(geo, m);
    const o = new T.Mesh(geo, m);
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
    r = 0.014,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)),
      m,
      x,
      y,
      z,
    );
  const plaque = (
    parent: T.Object3D,
    title: string,
    subtitle: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    dark = false,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const c = canvas.getContext('2d')!;
    c.fillStyle = dark ? '#343633' : '#eee8da';
    c.fillRect(0, 0, 1024, 256);
    c.fillStyle = dark ? '#baa98c' : '#786a51';
    c.font = '27px sans-serif';
    c.fillText(subtitle, 38, 65, 948);
    c.fillStyle = dark ? '#f0eadf' : '#35423b';
    c.font = '48px sans-serif';
    c.fillText(title, 38, 142, 948);
    c.fillStyle = dark ? '#b8bbb0' : '#7c7e6f';
    c.font = '23px sans-serif';
    c.fillText('S A T O R I   /   OBJECT COLLECTION', 38, 204, 948);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 8;
    k.textures.push(texture);
    const m = material('#ffffff');
    m.map = texture;
    const panel = box(parent, w, h, 0.009, x, y, z, m, 0.003);
    panel.castShadow = false;
  };
  const cabinet = new T.Group();
  cabinet.name = 'Gallery / model archive cabinet';
  cabinet.userData.id = 'galleryArchive';
  cabinet.position.set(galleryCabinet.x, 0, galleryCabinet.z);
  cabinet.rotation.y = Math.PI / 2;
  k.root.add(cabinet);
  k.groups.set('galleryArchive', cabinet);
  k.interactables.push(cabinet);
  const cw = galleryCabinet.depth,
    cd = galleryCabinet.width,
    ch = galleryCabinet.height;
  box(cabinet, cw, ch - 0.17, 0.055, 0, ch / 2 + 0.075, -cd / 2 + 0.035, k.oak);
  for (const x of [-cw / 2 + 0.04, cw / 2 - 0.04])
    box(cabinet, 0.08, ch - 0.13, cd, x, ch / 2 + 0.065, 0, k.oak);
  for (const y of [0.15, 0.83, 1.48, 2.13, ch - 0.03])
    box(cabinet, cw, 0.065, cd, 0, y, 0, k.oak);
  box(cabinet, cw - 0.17, 0.23, cd - 0.03, 0, 0.31, 0, ink);
  plaque(
    cabinet,
    '三维藏品室',
    'THE OBJECT ARCHIVE',
    1.24,
    0.26,
    0,
    2.34,
    cd / 2 + 0.013,
  );
  for (const x of [-0.12, 0.12])
    box(cabinet, 0.018, 0.26, 0.024, x, 1.28, cd / 2 + 0.044, bronze, 0.005);
  // Sliding glazing stays inside the cabinet footprint, including when selected.
  for (const x of [-0.405, 0.405]) {
    const pane = mesh(
      cabinet,
      new T.PlaneGeometry(0.79, 1.65),
      glass,
      x,
      1.31,
      cd / 2 + 0.014,
    );
    pane.castShadow = false;
  }
  for (const y of [0.79, 1.44, 2.09])
    box(cabinet, 1.58, 0.012, 0.018, 0, y, -0.19, glow, 0.003);
  // Decorative keepsakes have no relationship to the stored or exhibited GLBs.
  const decor = new T.Group();
  decor.name = 'Archive / decorative substitutes';
  cabinet.add(decor);
  const porcelain = material('#e8e1d0', 0.28),
    sage = material('#768572', 0.58);
  const clay = material('#ac795e', 0.76),
    pages = material('#dcd2b9', 0.92);
  for (let i = 0; i < 5; i++) {
    const x = -0.57 + i * 0.115,
      h = 0.27 + (i % 3) * 0.027;
    box(
      decor,
      0.098,
      h,
      0.24,
      x,
      0.468 + h / 2,
      -0.02,
      i % 2 ? sage : clay,
      0.005,
    );
    box(decor, 0.075, h - 0.035, 0.006, x, 0.468 + h / 2, 0.103, pages, 0.002);
    for (const y of [0.51, 0.69])
      box(decor, 0.078, 0.008, 0.01, x, y, 0.11, bronze, 0.002);
  }
  const vaseProfile = [
    [0, 0],
    [0.07, 0],
    [0.115, 0.045],
    [0.13, 0.15],
    [0.1, 0.25],
    [0.052, 0.3],
    [0.05, 0.36],
    [0.043, 0.36],
    [0.043, 0.3],
    [0.09, 0.245],
    [0.12, 0.15],
    [0.105, 0.05],
    [0.065, 0.015],
    [0, 0.015],
  ];
  for (const [x, y, s, m] of [
    [-0.4, 0.863, 1, porcelain],
    [0.02, 0.863, 0.78, sage],
    [0.48, 1.513, 1.12, clay],
  ] as const) {
    const vase = mesh(
      decor,
      new T.LatheGeometry(
        vaseProfile.map(([r, h]) => new T.Vector2(r, h)),
        32,
      ),
      m,
      x,
      y,
      -0.015,
    );
    vase.scale.setScalar(s);
  }
  box(decor, 0.32, 0.035, 0.28, -0.32, 1.53, 0, ink);
  const ring = mesh(
    decor,
    new T.TorusGeometry(0.145, 0.03, 12, 48),
    bronze,
    -0.32,
    1.72,
    0,
  );
  ring.rotation.y = 0.25;
  for (let i = 0; i < 3; i++)
    box(
      decor,
      0.32 - i * 0.035,
      0.037,
      0.24,
      0.44,
      0.487 + i * 0.04,
      0,
      i % 2 ? pages : sage,
      0.004,
    );
  k.cutaways.add([cabinet], { x: 4, z: 6.55, nx: 1, nz: 0 }, ['gallery'], true);

  // Soft studio reflections belong only to the metal exhibits, keeping room finishes unchanged.
  const faces = [
    '#b9c3c7',
    '#c1b9aa',
    '#e9e5dc',
    '#5a6268',
    '#ccd1cd',
    '#839098',
  ].map((color, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.fillStyle = color;
    c.fillRect(0, 0, 128, 128);
    if (index !== 3) {
      const gradient = c.createLinearGradient(0, 0, 128, 128);
      gradient.addColorStop(0, '#fff8e6');
      gradient.addColorStop(1, color);
      c.fillStyle = gradient;
      c.fillRect(18, 10, 76, 85);
    }
    return canvas;
  });
  const reflections = new T.CubeTexture(faces);
  reflections.colorSpace = T.SRGBColorSpace;
  reflections.needsUpdate = true;
  k.textures.push(reflections);
  const track = new T.Group();
  k.root.add(track);
  box(track, 5.2, 0.045, 0.065, 0.32, 3.6, 0.5, ink, 0.008);
  const displays = galleryPlinths.map((spec, index) => {
    const item = exhibits[index],
      group = new T.Group();
    group.name = spec.id;
    group.userData.id = spec.id;
    group.position.set(spec.x, 0, spec.z);
    k.root.add(group);
    k.groups.set(spec.id, group);
    k.interactables.push(group);
    box(
      group,
      spec.width - 0.09,
      spec.height - 0.25,
      spec.depth - 0.09,
      0,
      (spec.height + 0.07) / 2,
      0,
      walnut,
      0.045,
    );
    box(
      group,
      spec.width - 0.18,
      0.085,
      spec.depth - 0.18,
      0,
      0.1225,
      0,
      ink,
      0.008,
    );
    // A stone cap floats visually above a fine metal reveal; the sculpture datum stays fixed.
    box(
      group,
      spec.width - 0.06,
      0.012,
      spec.depth - 0.06,
      0,
      spec.height - 0.098,
      0,
      bronze,
      0.006,
    );
    box(
      group,
      spec.width,
      0.092,
      spec.depth,
      0,
      spec.height - 0.046,
      0,
      limestone,
      0.024,
    );
    for (const x of [-1, 1]) {
      // Recessed shadow lines flank the front panel, never projecting into the aisle.
      box(
        group,
        0.008,
        spec.height - 0.31,
        0.004,
        x * (spec.width / 2 - 0.115),
        (spec.height + 0.07) / 2,
        spec.depth / 2 - 0.043,
        ink,
        0.001,
      );
    }
    const turntable = new T.Group();
    turntable.position.y = spec.height;
    group.add(turntable);
    mesh(
      turntable,
      new T.CylinderGeometry(0.51, 0.51, 0.008, 80),
      bronze,
      0,
      0.005,
      0,
    );
    mesh(
      turntable,
      new T.CylinderGeometry(0.503, 0.503, 0.037, 80),
      ink,
      0,
      0.0275,
      0,
    );
    plaque(
      group,
      item.title,
      `0${index + 1} / ${item.category}`,
      0.73,
      0.183,
      0,
      0.605,
      spec.depth / 2 - 0.036,
      true,
    );
    const mount = new T.Group();
    mount.position.y = 0.048;
    turntable.add(mount);
    group.userData.modelStatus = 'loading';
    k.assets.register('gallery', item.roomAssetId!, async () => {
      const gltf = await loadAssetGltf(item.roomAssetId!);
      const model = gltf.scene;
      model.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometry.add(o.geometry);
          o.castShadow = true;
          o.receiveShadow = false;
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            modelMaterials.add(m);
            if (m instanceof T.MeshStandardMaterial) {
              m.envMap = reflections;
              m.envMapIntensity = 0.95;
            }
            for (const v of Object.values(m))
              if (v instanceof T.Texture) {
                v.anisotropy = 8;
                modelTextures.add(v);
              }
          }
        }
      });
      if (disposed) {
        release();
        return;
      }
      const bounds = new T.Box3().setFromObject(model),
        size = bounds.getSize(new T.Vector3()),
        center = bounds.getCenter(new T.Vector3());
      const fit = Math.min(1.0 / Math.hypot(size.x, size.z), 1.36 / size.y);
      model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
      const holder = new T.Group();
      holder.add(model);
      holder.scale.setScalar(fit);
      mount.add(holder);
      group.userData.modelStatus = 'ready';
      k.onReady();
    });
    const light = new T.SpotLight('#fff0dc', 5, 5, 0.5, 0.7, 1.5);
    light.position.set(spec.x + 0.1, 3.32, spec.z + 0.55);
    light.target.position.set(spec.x, 1.65, spec.z);
    k.root.add(light, light.target);
    const fixture = new T.Group();
    fixture.position.copy(light.position);
    fixture.lookAt(light.target.position);
    k.root.add(fixture);
    mesh(
      fixture,
      new T.CylinderGeometry(0.07, 0.08, 0.18, 20),
      ink,
    ).rotation.x = Math.PI / 2;
    mesh(fixture, new T.CircleGeometry(0.063, 24), glow, 0, 0, 0.095);
    const hanger = new T.Group();
    k.root.add(hanger);
    box(
      hanger,
      0.018,
      0.23,
      0.018,
      light.position.x,
      3.455,
      light.position.z,
      ink,
      0.004,
    );
    if (Math.abs(light.position.z - 0.5) > 0.04)
      box(
        hanger,
        0.025,
        0.03,
        Math.abs(light.position.z - 0.5) + 0.06,
        light.position.x,
        3.6,
        (light.position.z + 0.5) / 2,
        ink,
        0.006,
      );
    return { id: spec.id, turntable, light, fixture, hanger };
  });
  function release() {
    geometry.forEach((g) => g.dispose());
    modelMaterials.forEach((m) => m.dispose());
    modelTextures.forEach(releaseAssetTexture);
    geometry.clear();
    modelMaterials.clear();
    modelTextures.clear();
  }
  return {
    // Personal project editing remains available from the study portfolio.
    setProjects: (_projects: Project[]) => {},
    focus(id: ObjectId | null) {
      focus = id;
    },
    update(
      dt: number,
      reduced: boolean,
      night: boolean,
      enabled: boolean,
      plan: boolean,
    ) {
      for (const entry of displays) {
        const selected = focus === entry.id;
        if (selected && !reduced)
          entry.turntable.rotation.y += Math.min(dt, 0.05) * 0.13;
        entry.light.intensity = T.MathUtils.lerp(
          entry.light.intensity,
          enabled ? (selected ? 10 : night ? 6 : 4.7) : 0,
          1 - Math.exp(-dt * 3),
        );
        entry.fixture.visible =
          entry.hanger.visible =
          track.visible =
            !plan && !focus;
      }
    },
    dispose() {
      disposed = true;
      release();
    },
  };
}
