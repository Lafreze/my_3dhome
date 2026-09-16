import * as T from 'three';
import type { RoomAssets } from './asset-loading';
import { furnitureSuite, neutralFurnitureFinish } from './furniture-suite';
import { interiorMaterial } from './house-finishes';
import { localPbr } from './room-materials';

/** A room-sized material palette; photographed grain and microstructure remain shared on the GPU. */
export function bedroomMaterials(
  materials: T.Material[],
  textures: T.Texture[],
  assets: RoomAssets,
) {
  const suite = furnitureSuite(materials, textures, assets);
  function timber(color: string, name: string) {
    const m = suite.timber.clone();
    m.color.set(color);
    m.name = `Bedroom / ${name}`;
    m.roughness = 0.9;
    m.clearcoat = 0.07;
    m.clearcoatRoughness = 0.65;
    m.normalScale.setScalar(0.18);
    neutralFurnitureFinish(m, 'timber');
    materials.push(m);
    return m;
  }
  const wood = timber('#c4b195', 'natural white oak');
  const pale = timber('#ded2bb', 'limed oak');
  const dark = timber('#85725b', 'oak end grain');
  const floor = ['#baaa92', '#c3b198', '#beac93', '#b8a68e', '#c0ae96'].map(
    (color, i) => {
      const m = timber(color, `floorboard ${i + 1}`);
      m.clearcoat = 0.05;
      m.userData.live = true;
      return m;
    },
  );
  const wall = new T.MeshPhysicalMaterial({
    color: '#e8e1d5',
    ...localPbr(
      assets,
      textures,
      'white_plaster_02',
      new T.Vector2(1, 1),
      false,
    ),
    roughness: 0.97,
    normalScale: new T.Vector2(0.12, 0.12),
    envMapIntensity: 0.45,
  });
  wall.name = 'Bedroom / mineral plaster';
  wall.userData.surface = 'plaster';
  materials.push(wall);
  function cloth(
    color: string,
    kind: 'cotton' | 'linen' | 'wool' | 'boucle',
    scale: number,
  ) {
    const m = interiorMaterial(kind, color, materials, textures);
    const detail = localPbr(
      assets,
      textures,
      'fabric_pattern_07',
      new T.Vector2(scale, scale),
      false,
    );
    m.normalMap = detail.normalMap;
    m.normalScale.setScalar(kind === 'wool' || kind === 'boucle' ? 0.24 : 0.12);
    m.bumpScale = 0.0012;
    // The photographed roughness preserves fibre variation, without a plastic highlight.
    m.roughnessMap = detail.roughnessMap;
    m.roughness = 1;
    m.sheen = kind === 'cotton' ? 0.35 : 0.48;
    m.sheenColor.set('#e6ddcf');
    m.sheenRoughness = 0.9;
    m.envMapIntensity = 0.5;
    m.name = `Bedroom / ${kind}`;
    return m;
  }
  const linen = cloth('#e4dacc', 'linen', 5);
  const cotton = cloth('#e9e3d8', 'cotton', 6);
  const wool = cloth('#b7aa99', 'wool', 4);
  const rug = cloth('#d1c5b2', 'boucle', 9);
  const curtain = cloth('#e6ded0', 'linen', 4);
  curtain.side = T.DoubleSide;
  const metal = interiorMaterial(
    'brushed-metal',
    '#a59982',
    materials,
    textures,
  );
  metal.metalness = 0.78;
  metal.roughness = 0.46;
  metal.bumpScale = 0.0006;
  return {
    wood,
    pale,
    dark,
    floor,
    wall,
    linen,
    cotton,
    wool,
    rug,
    curtain,
    metal,
  };
}

/** Keep plaster pores at the same physical scale on narrow strips and full walls. */
export function fitPlasterGrain(geometry: T.BufferGeometry) {
  if (geometry.userData.plasterFitted) return;
  const p = geometry.getAttribute('position'),
    n = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv');
  if (!p || !n || !uv) return;
  for (let i = 0; i < p.count; i++) {
    const face =
      Math.abs(n.getX(i)) > 0.7 ? 0 : Math.abs(n.getY(i)) > 0.7 ? 1 : 2;
    uv.setXY(
      i,
      (face === 0 ? p.getZ(i) : p.getX(i)) / 1.6,
      (face === 1 ? p.getZ(i) : p.getY(i)) / 1.6,
    );
  }
  geometry.userData.plasterFitted = true;
  uv.needsUpdate = true;
}
