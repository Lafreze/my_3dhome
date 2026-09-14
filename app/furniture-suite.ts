import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { deferredTexture, type RoomAssets } from './asset-loading';
import { fitTimberGrain, interiorMaterial } from './house-finishes';
import { interiorPalette as palette } from './interior-palette';

type FinishRole = 'upholstery' | 'timber';
/** Refinish photographed albedo without losing its creases, pores or baked shading. */
export function neutralFurnitureFinish(
  material: T.MeshStandardMaterial,
  role: FinishRole,
) {
  const luminance =
    role === 'timber'
      ? 'clamp(0.35 + 1.8 * pow(clamp(furnitureLuma, 0.0, 1.0), 0.65), 0.55, 1.18)'
      : 'mix(0.82, 1.0, pow(clamp(furnitureLuma, 0.0, 1.0), 0.25))';
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_fragment>',
        T.ShaderChunk.map_fragment.replace(
          'diffuseColor *= sampledDiffuseColor;',
          `
      float furnitureLuma = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      sampledDiffuseColor.rgb = vec3(${luminance});
      diffuseColor *= sampledDiffuseColor;
    `,
        ),
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${role === 'timber' ? '0.46' : '0.64'});`,
      );
  };
  material.customProgramCacheKey = () => `ivory-oak-suite-v1-${role}`;
  material.needsUpdate = true;
}
const suites = new WeakMap<T.Material[], ReturnType<typeof buildSuite>>();
function buildSuite(
  materials: T.Material[],
  textures: T.Texture[],
  assets: RoomAssets,
) {
  const map = deferredTexture(assets, 'shared', 'furniture.oak.color');
  const normalMap = deferredTexture(
    assets,
    'shared',
    'furniture.oak.normal',
    true,
  );
  const roughnessMap = deferredTexture(
    assets,
    'shared',
    'furniture.oak.roughness',
  );
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 8;
    // Real veneer grain runs vertically in the source; table joinery UVs run along U.
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
    textures.push(texture);
  }
  map.colorSpace = T.SRGBColorSpace;
  const timber = new T.MeshPhysicalMaterial({
    color: palette.furnitureOak,
    map,
    normalMap,
    roughnessMap,
    normalScale: new T.Vector2(0.28, 0.28),
    roughness: 0.82,
    clearcoat: 0.16,
    clearcoatRoughness: 0.54,
    envMapIntensity: 0.7,
  });
  timber.name = 'Furniture / white oak';
  timber.userData.surface = 'ash';
  neutralFurnitureFinish(timber, 'timber');
  const edge = timber.clone();
  edge.color.set(palette.furnitureEdge);
  edge.name = 'Furniture / oak edge';
  neutralFurnitureFinish(edge, 'timber');
  // Cabinet interiors and limed fronts keep the same photographed grain and light response.
  const pale = timber.clone();
  pale.color.set('#dfd3bf');
  pale.name = 'Furniture / limed oak';
  neutralFurnitureFinish(pale, 'timber');
  const recess = timber.clone();
  recess.color.set('#958776');
  recess.name = 'Furniture / shaded oak';
  neutralFurnitureFinish(recess, 'timber');
  const lacquer = new T.MeshPhysicalMaterial({
    color: palette.furnitureIvory,
    roughness: 0.56,
    clearcoat: 0.2,
    clearcoatRoughness: 0.48,
    envMapIntensity: 0.65,
  });
  lacquer.name = 'Furniture / satin ivory lacquer';
  lacquer.userData.surface = 'lacquer';
  materials.push(timber, edge, pale, recess, lacquer);
  const stone = interiorMaterial('travertine', '#e7e0d3', materials, textures);
  stone.roughness = 0.74;
  stone.bumpScale *= 0.55;
  const metal = interiorMaterial(
    'brushed-metal',
    '#b8afa0',
    materials,
    textures,
  );
  metal.roughness = 0.48;
  return { timber, edge, pale, recess, lacquer, stone, metal };
}
export function furnitureSuite(
  materials: T.Material[],
  textures: T.Texture[],
  assets: RoomAssets,
) {
  let suite = suites.get(materials);
  if (!suite) {
    suite = buildSuite(materials, textures, assets);
    suites.set(materials, suite);
  }
  return suite;
}
/** Rounded, undercut table edge, with a stable top plane for all existing tabletop objects. */
export function refinedTabletop(
  parent: T.Group,
  width: number,
  depth: number,
  top: number,
  suite: ReturnType<typeof furnitureSuite>,
  round = false,
  stone = false,
) {
  const thickness = 0.095;
  const geometry = round
    ? new T.LatheGeometry(
        [
          [0, -thickness],
          [width / 2 - 0.024, -thickness],
          [width / 2 - 0.006, -0.07],
          [width / 2, -0.025],
          [width / 2 - 0.006, -0.006],
          [width / 2 - 0.019, 0],
          [0, 0],
        ].map((p) => new T.Vector2(...p)),
        80,
      )
    : new RoundedBoxGeometry(width, thickness, depth, 5, 0.034);
  const material = stone ? suite.stone : suite.timber;
  if (round) {
    const p = geometry.getAttribute('position'),
      uv = geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, p.getX(i) / 1.8 + 0.5, p.getZ(i) / 0.48 + 0.5);
  } else fitTimberGrain(geometry, suite.timber);
  const surface = new T.Mesh(geometry, material);
  surface.position.y = round ? top : top - thickness / 2;
  surface.castShadow = surface.receiveShadow = true;
  surface.name = 'Furniture / eased tabletop';
  parent.add(surface);
  const undercut = new T.Mesh(
    round
      ? new T.CylinderGeometry(width / 2 - 0.055, width / 2 - 0.07, 0.018, 64)
      : new RoundedBoxGeometry(width - 0.09, 0.018, depth - 0.09, 3, 0.008),
    suite.edge,
  );
  fitTimberGrain(undercut.geometry, suite.edge);
  undercut.position.y = top - thickness - 0.006;
  undercut.castShadow = undercut.receiveShadow = true;
  parent.add(undercut);
  return surface;
}
