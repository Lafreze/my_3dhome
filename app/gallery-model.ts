import * as T from 'three';
import {
  loadAssetGltf,
  releaseAssetTexture,
  type RoomAssets,
} from './asset-loading';

export function loadGalleryModel(
  parent: T.Group,
  onReady: () => void,
  assets: RoomAssets,
) {
  let disposed = false;
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  function release() {
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach(releaseAssetTexture);
  }
  assets.register('gallery', 'room.gallery.sculpture', () =>
    loadAssetGltf('room.gallery.sculpture')
      .then((gltf) => {
        const model = gltf.scene;
        model.name = 'gallery/crowned-rabbit';
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            geometry.add(o.geometry);
            o.castShadow = true;
            // Dense sculpted fur should not receive coarse house shadow-map acne.
            o.receiveShadow = false;
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              materials.add(m);
              for (const value of Object.values(m))
                if (value instanceof T.Texture) {
                  value.anisotropy = 8;
                  textures.add(value);
                }
              if (
                m instanceof T.MeshStandardMaterial &&
                m.name === 'Ivory white fur'
              ) {
                m.metalness = 0;
                m.roughness = 0.93;
              }
            }
          }
        });
        if (disposed) {
          release();
          return;
        }
        // Defensive fit also covers a future replacement asset with different authored units.
        const bounds = new T.Box3().setFromObject(model),
          size = bounds.getSize(new T.Vector3()),
          center = bounds.getCenter(new T.Vector3());
        const scale = Math.min(0.84 / Math.max(size.x, size.z), 1.16 / size.y);
        model.position.set(
          -center.x * scale,
          -bounds.min.y * scale,
          -center.z * scale,
        );
        model.scale.multiplyScalar(scale);
        parent.add(model);
        parent.userData.modelStatus = 'ready';
        onReady();
      })
      .catch((error) => {
        if (!disposed) {
          parent.userData.modelStatus = 'error';
          throw error;
        }
      }),
  );
  return {
    dispose() {
      disposed = true;
      release();
    },
  };
}
