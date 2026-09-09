import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { defaultProfile, type ObjectId, type Project } from './room-data';

export const galleryProjectIndex: Partial<Record<ObjectId, number>> = {
  gallerySculpture: 0,
  galleryGame: 1,
  galleryCase: 2,
};

type Kit = {
  root: T.Group;
  materials: T.Material[];
  textures: T.Texture[];
  groups: Map<ObjectId, T.Group>;
  interactables: T.Object3D[];
  oak: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
};

/** Editable project covers, a small object portrait and a focused pool of light per work. */
export function createProjectGallery(k: Kit) {
  const material = (color: string, roughness = 0.65, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    m.userData.live = true;
    k.materials.push(m);
    return m;
  };
  const plaster = material('#dfd8c9', 0.93),
    ink = material('#2b3438', 0.33, 0.45),
    sage = material('#7d8877'),
    paper = material('#eee9dc', 0.85),
    bronze = k.brass;
  const lens = material('#fff0d1');
  lens.emissive.set('#ffd397');
  lens.emissiveIntensity = 0.8;
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
    radius = 0.02,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, h / 3, w / 3, d / 3)),
      m,
      x,
      y,
      z,
    );
  const specs = [
    { id: 'gallerySculpture' as const, x: 0.1, z: -0.45, w: 1, d: 1, h: 1.02 },
    { id: 'galleryGame' as const, x: -2.9, z: -0.15, w: 0.8, d: 0.7, h: 1.03 },
    { id: 'galleryCase' as const, x: 2.5, z: 0.2, w: 0.82, d: 1.7, h: 0.9 },
  ];
  const covers = specs.map((spec, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1080;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 8;
    k.textures.push(texture);
    const cover = material('#ffffff', 0.89);
    cover.map = texture;
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 640;
    labelCanvas.height = 180;
    const labelTexture = new T.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = T.SRGBColorSpace;
    k.textures.push(labelTexture);
    const card = material('#ffffff');
    card.map = labelTexture;
    const group = new T.Group();
    group.position.set(spec.x, 0, spec.z);
    group.userData.id = spec.id;
    group.name = spec.id;
    k.root.add(group);
    k.groups.set(spec.id, group);
    k.interactables.push(group);
    box(
      group,
      spec.w,
      spec.h - 0.13,
      spec.d,
      0,
      (spec.h + 0.03) / 2,
      0,
      plaster,
      0.026,
    );
    box(group, spec.w - 0.06, 0.06, spec.d - 0.06, 0, 0.105, 0, ink, 0.008);
    const rotating = new T.Group();
    rotating.position.y = spec.h;
    rotating.name = `${spec.id}/turntable`;
    group.add(rotating);
    mesh(
      rotating,
      new T.CylinderGeometry(spec.w * 0.47, spec.w * 0.47, 0.035, 64),
      k.oak,
      0,
      0.018,
      0,
    );
    const plaque = box(
      group,
      spec.w * 0.77,
      0.155,
      0.012,
      0,
      spec.h - 0.25,
      spec.d / 2 + 0.008,
      card,
      0.002,
    );
    plaque.castShadow = false;
    if (index === 0) {
      // A silicon die floats within a circuit-board portrait; no invented performance claims.
      const chip = new T.Group();
      chip.rotation.set(-0.2, 0.35, 0.1);
      chip.position.y = 0.45;
      rotating.add(chip);
      box(chip, 0.6, 0.08, 0.6, 0, 0, 0, ink);
      box(chip, 0.29, 0.035, 0.29, 0, 0.056, 0, bronze, 0.009);
      for (let i = 0; i < 8; i++)
        for (const side of [-1, 1]) {
          box(
            chip,
            0.055,
            0.018,
            0.1,
            -0.24 + i * 0.069,
            0,
            side * 0.33,
            bronze,
            0.002,
          );
          box(
            chip,
            0.1,
            0.018,
            0.055,
            side * 0.33,
            0,
            -0.24 + i * 0.069,
            bronze,
            0.002,
          );
        }
      for (let i = 0; i < 4; i++)
        box(
          chip,
          0.235,
          0.004,
          0.011,
          0,
          0.076,
          -0.084 + i * 0.056,
          ink,
          0.001,
        );
      mesh(
        rotating,
        new T.CylinderGeometry(0.018, 0.032, 0.37, 12),
        bronze,
        0,
        0.205,
        0,
      );
      const orbit = mesh(
        rotating,
        new T.TorusGeometry(0.42, 0.01, 8, 72),
        bronze,
        0,
        0.46,
        0,
      );
      orbit.rotation.set(0.5, 0.3, -0.4);
    } else if (index === 1) {
      // A tiny game world: shelter, companion and an orbiting play token.
      box(rotating, 0.32, 0.3, 0.31, -0.075, 0.24, 0, sage, 0.035);
      const roof = mesh(
        rotating,
        new T.ConeGeometry(0.3, 0.22, 4),
        k.oak,
        -0.075,
        0.48,
        0,
      );
      roof.rotation.y = Math.PI / 4;
      box(rotating, 0.08, 0.13, 0.008, -0.075, 0.195, 0.161, ink);
      for (const [x, y, r] of [
        [0.15, 0.16, 0.075],
        [0.11, 0.245, 0.035],
        [0.2, 0.245, 0.035],
      ])
        mesh(rotating, new T.SphereGeometry(r, 20, 12), paper, x, y, 0.12);
    } else {
      for (let i = 0; i < 3; i++) {
        const card = new T.Group();
        card.position.set((i - 1) * 0.15, 0.3, (i - 1) * 0.12);
        card.rotation.set(-0.12, (i - 1) * 0.25, (i - 1) * -0.15);
        rotating.add(card);
        box(card, 0.26, 0.42, 0.024, 0, 0, 0, ink, 0.018);
        const ring = mesh(
          card,
          new T.TorusGeometry(0.064, 0.004, 6, 40),
          bronze,
          0,
          0.01,
          0.016,
        );
        ring.scale.y = 1.3;
        mesh(card, new T.SphereGeometry(0.018, 12, 8), paper, 0, 0.12, 0.018);
      }
    }
    const light = new T.SpotLight('#ffe0ad', 5, 5, 0.4, 0.75, 1.6);
    light.position.set(spec.x + 0.12, 3.22, spec.z - 0.42);
    light.target.position.set(spec.x, spec.h + 0.18, spec.z);
    light.name = `${spec.id}/spotlight`;
    k.root.add(light, light.target);
    const fixture = new T.Group();
    k.root.add(fixture);
    fixture.position.copy(light.position);
    fixture.lookAt(light.target.position);
    mesh(
      fixture,
      new T.CylinderGeometry(0.075, 0.075, 0.19, 24),
      ink,
    ).rotation.x = Math.PI / 2;
    mesh(fixture, new T.CircleGeometry(0.067, 24), lens, 0, 0, 0.1);
    const hanger = new T.Group();
    k.root.add(hanger);
    box(
      hanger,
      0.035,
      0.37,
      0.035,
      spec.x + 0.12,
      3.435,
      spec.z - 0.42,
      ink,
      0.006,
    );
    box(
      hanger,
      0.035,
      0.035,
      Math.abs(spec.z - 0.32) + 0.06,
      spec.x + 0.12,
      3.61,
      (spec.z - 0.32) / 2 - 0.1,
      ink,
      0.006,
    );
    return {
      hanger,
      canvas,
      texture,
      cover,
      labelCanvas,
      labelTexture,
      rotating,
      light,
      fixture,
      index,
      id: spec.id,
      revision: 0,
      signature: '',
    };
  });
  const rail = new T.Group();
  k.root.add(rail);
  box(rail, 5.75, 0.045, 0.065, -0.05, 3.61, -0.1, ink, 0.01);
  let focus: ObjectId | null = null,
    disposed = false;
  function setProjects(projects: Project[]) {
    covers.forEach((entry) => {
      const project = projects[entry.index];
      const signature = JSON.stringify(project ?? null);
      if (entry.signature === signature) return;
      entry.signature = signature;
      const revision = ++entry.revision;
      const c = entry.canvas.getContext('2d')!,
        label = entry.labelCanvas.getContext('2d')!;
      c.fillStyle = '#e8e1d2';
      c.fillRect(0, 0, 768, 1080);
      c.fillStyle = '#343d3c';
      c.fillRect(54, 62, 660, 740);
      c.strokeStyle = '#c4b18a';
      c.lineWidth = 3;
      if (entry.index === 0) {
        for (let i = 0; i < 7; i++) {
          c.strokeRect(210 + i * 19, 230 + i * 19, 348 - i * 38, 348 - i * 38);
          c.beginPath();
          c.moveTo(82, 280 + i * 41);
          c.lineTo(200, 280 + i * 41);
          c.moveTo(568, 280 + i * 41);
          c.lineTo(686, 280 + i * 41);
          c.stroke();
        }
      } else if (entry.index === 1) {
        for (let i = 0; i < 7; i++) {
          c.fillStyle = i % 2 ? '#879a80' : '#d9ccb0';
          c.fillRect(
            125 + (i % 3) * 163,
            210 + Math.floor(i / 3) * 153,
            139,
            126,
          );
        }
      } else {
        for (let i = 0; i < 3; i++) {
          c.save();
          c.translate(260 + i * 125, 410);
          c.rotate((i - 1) * 0.23);
          c.fillStyle = '#343d3c';
          c.fillRect(-95, -175, 190, 350);
          c.strokeRect(-95, -175, 190, 350);
          c.beginPath();
          c.ellipse(0, 0, 52, 74, 0, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        }
      }
      c.fillStyle = '#4b514b';
      c.font = '24px sans-serif';
      c.fillText(project?.category || 'OPEN DISPLAY', 54, 868, 660);
      c.font = '36px sans-serif';
      c.fillText(project?.title || '待布置展位', 54, 935, 660);
      c.font = '19px sans-serif';
      c.fillText(
        project?.image ? 'SELECTED WORK' : 'PROJECT COVER / 项目概念封面',
        54,
        1013,
        660,
      );
      label.fillStyle = '#ede7db';
      label.fillRect(0, 0, 640, 180);
      label.fillStyle = '#3f4945';
      label.font = '24px sans-serif';
      label.fillText(
        `0${entry.index + 1} / ${project?.category || 'OPEN DISPLAY'}`,
        22,
        49,
        596,
      );
      label.font = '35px sans-serif';
      label.fillText(project?.title || '待布置展位', 22, 111, 596);
      label.font = '18px sans-serif';
      label.fillText(
        project ? '点击阅读项目 · SELECT TO EXPLORE' : '在作品编辑器添加项目',
        22,
        154,
        596,
      );
      entry.texture.needsUpdate = entry.labelTexture.needsUpdate = true;
      if (project?.image) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          if (disposed || entry.revision !== revision) return;
          const scale = Math.min(660 / image.width, 740 / image.height);
          c.fillStyle = '#343d3c';
          c.fillRect(54, 62, 660, 740);
          c.drawImage(
            image,
            54 + (660 - image.width * scale) / 2,
            62 + (740 - image.height * scale) / 2,
            image.width * scale,
            image.height * scale,
          );
          entry.texture.needsUpdate = true;
        };
        image.src = project.image;
      }
    });
  }
  setProjects(defaultProfile.projects);
  return {
    covers: covers.map((c) => ({ material: c.cover, texture: c.texture })),
    setProjects,
    focus(id: ObjectId | null) {
      focus = id && galleryProjectIndex[id] !== undefined ? id : null;
    },
    update(
      dt: number,
      reduced: boolean,
      night: boolean,
      enabled: boolean,
      plan: boolean,
    ) {
      for (const entry of covers) {
        const selected = focus === entry.id;
        if (selected && !reduced) entry.rotating.rotation.y += dt * 0.16;
        entry.light.intensity = T.MathUtils.lerp(
          entry.light.intensity,
          enabled ? (selected ? 12 : focus ? 1.8 : night ? 7 : 4.5) : 0,
          1 - Math.exp(-dt * 3),
        );
        rail.visible =
          entry.hanger.visible =
          entry.fixture.visible =
            !plan && !focus;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
