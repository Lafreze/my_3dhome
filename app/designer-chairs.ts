import * as T from 'three';
import {
  loadAssetGltf,
  releaseAssetTexture,
  type RoomAssets,
} from './asset-loading';
import {
  chairPlacement,
  loungeHeight,
  designerChairs,
  type ChairModel,
} from './designer-chair-layout';
import { seatById } from './seat-data';
import type { SeatAnchors } from './seat-scene';
import { neutralFurnitureFinish } from './furniture-suite';
import { interiorPalette as palette } from './interior-palette';

/** Shared source meshes, room-scoped loading and a complete fallback until ready. */
export function installDesignerChairs(k: {
  seats: SeatAnchors;
  assets: RoomAssets;
  materials: T.Material[];
  textures: T.Texture[];
  readingMaterial: T.MeshStandardMaterial;
  onReady: () => void;
}) {
  let disposed = false;
  const sources = new Map<ChairModel, Promise<T.Group>>();
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  function release() {
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach(releaseAssetTexture);
    geometry.clear();
    materials.clear();
    textures.clear();
  }
  function source(id: ChairModel) {
    if (!sources.has(id)) {
      sources.set(
        id,
        loadAssetGltf(`furniture.chair.${id}`)
          .then((gltf) => {
            gltf.scene.traverse((o) => {
              if (!(o instanceof T.Mesh)) return;
              geometry.add(o.geometry);
              o.castShadow = true;
              o.receiveShadow = true;
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material]) {
                materials.add(m);
                for (const value of Object.values(m))
                  if (value instanceof T.Texture) {
                    value.anisotropy = 8;
                    textures.add(value);
                  }
                if (m instanceof T.MeshStandardMaterial) {
                  m.normalScale.setScalar(0.35);
                  m.roughness = 0.93;
                  m.metalness = 1;
                  m.envMapIntensity = 0.65;
                  if (
                    m.name === 'Chair upholstery' ||
                    m.name === 'Chair timber'
                  ) {
                    const role =
                      m.name === 'Chair timber' ? 'timber' : 'upholstery';
                    m.color.set(
                      role === 'timber'
                        ? palette.furnitureOak
                        : palette.furnitureIvory,
                    );
                    m.metalness = 0;
                    m.normalScale.setScalar(role === 'timber' ? 0.2 : 0.42);
                    neutralFurnitureFinish(m, role);
                  }
                }
              }
            });
            if (disposed) release();
            return gltf.scene;
          })
          .catch((error) => {
            sources.delete(id);
            throw error;
          }),
      );
    }
    return sources.get(id)!;
  }
  for (const chair of designerChairs) {
    const parent = k.seats.get(chair.seat)?.parent;
    if (!parent) continue;
    const fallback = new T.Group();
    fallback.name = 'Chair / fallback construction';
    // Reparenting removes children from the live array.
    for (const child of parent.children.slice()) {
      if (!child.name.startsWith('seat:') && child.name !== 'Seat reading book')
        fallback.add(child);
    }
    parent.add(fallback);
    parent.userData.designerChair = chair.model;
    parent.userData.modelStatus = 'pending';
    k.assets.register(
      seatById.get(chair.seat)!.room,
      `furniture.chair.${chair.model}`,
      async () => {
        const original = await source(chair.model).catch((error) => {
          if (!disposed) parent.userData.modelStatus = 'error';
          throw error;
        });
        if (disposed) return;
        const model = original.clone(true),
          fit = chairPlacement(chair);
        if (chair.model === 'mid-century-lounge')
          model.traverse((o) => {
            if (!(o instanceof T.Mesh)) return;
            o.geometry = o.geometry.clone();
            geometry.add(o.geometry);
            const p = o.geometry.getAttribute('position'),
              n = o.geometry.getAttribute('normal');
            const normal = new T.Vector3();
            for (let i = 0; i < p.count; i++) {
              const fitted = loungeHeight(chair, p.getY(i));
              p.setY(i, fitted.y);
              normal.fromBufferAttribute(n, i);
              normal.y /= fitted.slope;
              normal.normalize();
              n.setXYZ(i, normal.x, normal.y, normal.z);
            }
            p.needsUpdate = n.needsUpdate = true;
            o.geometry.computeBoundingBox();
            o.geometry.computeBoundingSphere();
          });
        model.name = `Chair / ${chair.model}`;
        model.scale.set(...fit.scale);
        model.rotation.y = fit.yaw;
        model.position.set(...fit.position);
        if (chair.upholstery)
          model.traverse((o) => {
            if (
              !(o instanceof T.Mesh) ||
              Array.isArray(o.material) ||
              o.material.name !== 'Chair upholstery'
            )
              return;
            const authored = o.material as T.MeshStandardMaterial;
            const upholstery =
              chair.seat === 'study-reading'
                ? k.readingMaterial
                : authored.clone();
            if (chair.seat !== 'study-reading') {
              upholstery.color.set(chair.upholstery!);
              materials.add(upholstery);
            }
            upholstery.map = authored.map;
            upholstery.normalMap = authored.normalMap;
            upholstery.roughnessMap = authored.roughnessMap;
            upholstery.bumpMap = null;
            upholstery.normalScale.setScalar(0.42);
            upholstery.roughness = 0.85;
            neutralFurnitureFinish(upholstery, 'upholstery');
            o.material = upholstery;
          });
        parent.add(model);
        fallback.visible = false;
        parent.userData.modelStatus = 'ready';
        k.onReady();
      },
    );
  }
  return {
    snapshot() {
      return designerChairs.map((chair) => {
        const anchor = k.seats.get(chair.seat)!,
          parent = anchor.parent!;
        const model = parent.getObjectByName(`Chair / ${chair.model}`);
        let seatError: number | null = null;
        if (model) {
          const point = anchor.getWorldPosition(new T.Vector3()),
            from = point.clone();
          from.y += 0.15;
          const hit = new T.Raycaster(
            from,
            new T.Vector3(0, -1, 0),
          ).intersectObject(model, true)[0];
          if (hit) seatError = hit.point.y - point.y;
        }
        return {
          seat: chair.seat,
          model: chair.model,
          status: parent.userData.modelStatus,
          fallbackVisible: parent.getObjectByName(
            'Chair / fallback construction',
          )?.visible,
          seatError,
        };
      });
    },
    dispose() {
      disposed = true;
      release();
    },
  };
}
