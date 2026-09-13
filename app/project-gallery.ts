import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ObjectId, Project } from './room-data';
import { exhibits, exhibitObjects } from './exhibit-data';
import { galleryPlinths, galleryCabinet } from './gallery-layout';
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
  const plaster = material('#e1dacc', 0.93),
    ink = material('#323a3a', 0.5, 0.25),
    bronze = material('#b99a65', 0.38, 0.6);
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
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#eee8da';
    c.fillRect(0, 0, 1024, 256);
    c.fillStyle = '#786a51';
    c.font = '24px sans-serif';
    c.fillText(subtitle, 38, 65, 948);
    c.fillStyle = '#35423b';
    c.font = '48px sans-serif';
    c.fillText(title, 38, 142, 948);
    c.fillStyle = '#7c7e6f';
    c.font = '23px sans-serif';
    c.fillText('SATORI  /  SELECT TO EXPLORE', 38, 204, 948);
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
  const miniatures = [0.435, 0.875, 1.525].map((y) => {
    const g = new T.Group();
    g.position.set(0, y, 0);
    cabinet.add(g);
    return g;
  });
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
      spec.width,
      spec.height - 0.14,
      spec.depth,
      0,
      (spec.height + 0.14) / 2,
      0,
      plaster,
      0.023,
    );
    box(
      group,
      spec.width - 0.08,
      0.06,
      spec.depth - 0.08,
      0,
      0.16,
      0,
      ink,
      0.008,
    );
    const turntable = new T.Group();
    turntable.position.y = spec.height;
    group.add(turntable);
    mesh(
      turntable,
      new T.CylinderGeometry(0.51, 0.51, 0.045, 64),
      k.oak,
      0,
      0.024,
      0,
    );
    plaque(
      group,
      item.title,
      `0${index + 1} / ${item.category}`,
      0.91,
      0.23,
      0,
      0.64,
      spec.depth / 2 + 0.011,
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
      const miniature = holder.clone(true);
      miniature.scale.multiplyScalar(index === 0 ? 0.26 : 0.38);
      miniatures[index].add(miniature);
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
