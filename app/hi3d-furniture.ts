import * as T from 'three';
import {
  loadAssetGltf,
  releaseAssetTexture,
  type RoomAssets,
} from './asset-loading';
import { assetManifest } from './asset-url';
import type { RoomId } from './house-data';

export const hi3dRooms = {
  'study-sailboat': 'study',
  'living-coffee-table': 'living',
  'bedroom-bench': 'bedroom',
  'gallery-bench': 'gallery',
  'cafe-communal-table': 'cafe',
  'gaming-travel-kit': 'gaming',
  'bar-citrus-board': 'bar',
  'library-book-cart': 'library',
  'corridor-letter-rack': 'corridor',
  'garden-drinks-cart': 'garden',
} as const satisfies Record<string, RoomId>;
export type Hi3dFurniture = keyof typeof hi3dRooms;

/** Capture just the finished shell. Later props and existing seat anchors stay independent. */
export function markHi3dReplacement(parent: T.Group, id: Hi3dFurniture) {
  const fallback = new T.Group();
  fallback.name = `Hi3D fallback / ${id}`;
  for (const child of parent.children.slice())
    if (!child.name.startsWith('seat:')) fallback.add(child);
  parent.add(fallback);
  fallback.userData.hi3dReplacement = id;
  return fallback;
}

export function localModelBounds(root: T.Object3D) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(),
    bounds = new T.Box3();
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.geometry.computeBoundingBox();
    if (o.geometry.boundingBox)
      bounds.union(
        o.geometry.boundingBox
          .clone()
          .applyMatrix4(inverse.clone().multiply(o.matrixWorld)),
      );
  });
  return bounds;
}

function settleSupportedProps(parent: T.Object3D, model: T.Group) {
  parent.updateWorldMatrix(true, true);
  for (const prop of parent.children) {
    const height = prop.userData.hi3dSupportY as number | undefined;
    if (height === undefined) continue;
    const box = localModelBounds(prop).applyMatrix4(prop.matrix);
    const center = box.getCenter(new T.Vector3());
    center.y = height + 0.23;
    const from = parent.localToWorld(center);
    const surfaces = new T.Raycaster(from, new T.Vector3(0, -1, 0))
      .intersectObject(model, true)
      .filter(
        (hit) =>
          hit.face &&
          hit.face.normal
            .clone()
            .applyNormalMatrix(
              new T.Matrix3().getNormalMatrix(hit.object.matrixWorld),
            ).y > 0.6,
      )
      .map((hit) => parent.worldToLocal(hit.point.clone()).y)
      .filter((y) => Math.abs(y - height) < 0.22)
      .sort((a, b) => Math.abs(a - height) - Math.abs(b - height));
    if (surfaces[0] === undefined) {
      prop.userData.hi3dSupportError = 'missing';
      continue;
    }
    const adjustment = surfaces[0] + 0.002 - box.min.y;
    prop.position.y += adjustment;
    prop.userData.hi3dSupportAdjustment = adjustment;
    prop.userData.hi3dSupportError = null;
  }
}

/** Load by room; retain the complete original construction on failure or while downloading. */
export function installHi3dFurniture(
  scene: T.Scene,
  assets: RoomAssets,
  onReady: () => void,
) {
  let disposed = false;
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const slots: {
    id: Hi3dFurniture;
    fallback: T.Group;
    bounds: T.Box3;
    model?: T.Group;
    status: string;
  }[] = [];
  scene.traverse((o) => {
    const id = o.userData.hi3dReplacement as Hi3dFurniture | undefined;
    if (id)
      slots.push({
        id,
        fallback: o as T.Group,
        bounds: localModelBounds(o),
        status: 'pending',
      });
  });
  // Later joinery passes belong to the original shell too, including details
  // attached directly to a room rather than to the furniture parent.
  const details: Partial<Record<Hi3dFurniture, string[]>> = {
    'living-coffee-table': ['Living / low table frame'],
    'bedroom-bench': [
      'Bedroom / upholstered bench welt',
      'Bedroom / bench saddle stitching',
    ],
    'gallery-bench': ['Gallery / ash bench finger joints'],
  };
  for (const slot of slots) {
    for (const name of details[slot.id] || []) {
      const detail = scene.getObjectByName(name);
      if (detail) slot.fallback.attach(detail);
    }
    slot.bounds = localModelBounds(slot.fallback);
  }
  const release = () => {
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach(releaseAssetTexture);
    geometry.clear();
    materials.clear();
    textures.clear();
  };
  for (const slot of slots) {
    const asset = `furniture.hi3d.${slot.id}`;
    if (!assetManifest.assets[asset]) {
      slot.status = 'unavailable';
      continue;
    }
    assets.register(hi3dRooms[slot.id], asset, async () => {
      try {
        const { scene: model } = await loadAssetGltf(asset);
        model.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          geometry.add(o.geometry);
          // Hi3D exports positions and UVs without normals; smooth the indexed
          // surface after decoding so curved wood and upholstery do not facet.
          const needsNormals = !o.geometry.getAttribute('normal');
          if (needsNormals) o.geometry.computeVertexNormals();
          o.castShadow = o.receiveShadow = true;
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            materials.add(m);
            for (const v of Object.values(m))
              if (v instanceof T.Texture) {
                v.anisotropy = 8;
                textures.add(v);
              }
            if (m instanceof T.MeshStandardMaterial) {
              if (needsNormals) m.flatShading = false;
              m.envMapIntensity = 0.55;
              m.normalScale.setScalar(0.55);
            }
          }
        });
        if (disposed) {
          release();
          return;
        }
        const authored = localModelBounds(model),
          sourceSize = authored.getSize(new T.Vector3());
        const size = slot.bounds.getSize(new T.Vector3());
        if (
          ![...sourceSize.toArray(), ...size.toArray()].every(
            (n) => Number.isFinite(n) && n > 0.000001,
          )
        )
          throw Error(`Invalid furniture bounds: ${slot.id}`);
        model.scale.copy(size.divide(sourceSize));
        model.position
          .copy(slot.bounds.min)
          .sub(authored.min.clone().multiply(model.scale));
        model.name = `Hi3D / ${slot.id}`;
        slot.fallback.parent!.add(model);
        settleSupportedProps(slot.fallback.parent!, model);
        slot.model = model;
        slot.fallback.visible = false;
        slot.status = 'ready';
        onReady();
      } catch (error) {
        slot.status = 'error';
        throw error;
      }
    });
  }
  return {
    snapshot: () =>
      slots.map(({ id, fallback, bounds, model, status }) => {
        const seatErrors: { seat: string; error: number | null }[] = [];
        if (model) {
          model.updateWorldMatrix(true, true);
          for (const seat of fallback.parent!.children.filter((o) =>
            o.name.startsWith('seat:'),
          )) {
            const point = seat.getWorldPosition(new T.Vector3());
            const hit = new T.Raycaster(
              point.clone().add(new T.Vector3(0, 0.2, 0)),
              new T.Vector3(0, -1, 0),
            ).intersectObject(model, true)[0];
            seatErrors.push({
              seat: seat.name.slice(5),
              error: hit ? hit.point.y - point.y : null,
            });
          }
        }
        return {
          id,
          room: hi3dRooms[id],
          status,
          fallbackVisible: fallback.visible,
          expectedSize: bounds.getSize(new T.Vector3()).toArray(),
          actualSize: model
            ? localModelBounds(model)
                .getSize(new T.Vector3())
                .multiply(model.scale)
                .toArray()
            : null,
          seatErrors,
          supports: fallback
            .parent!.children.filter(
              (o) => o.userData.hi3dSupportY !== undefined,
            )
            .map((o) => ({
              name: o.name,
              adjustment: o.userData.hi3dSupportAdjustment ?? null,
              error: o.userData.hi3dSupportError ?? null,
            })),
        };
      }),
    dispose() {
      disposed = true;
      release();
    },
  };
}
