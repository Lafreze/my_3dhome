import * as T from 'three';

// Keep CPU geometry and decoded maps for fast room return, but release GPU copies
// that have no visible consumer. Three.js recreates them when the room is revisited.
export function releaseHiddenRoomGpu(scene: T.Scene) {
  const visible = new Set<T.BufferGeometry | T.Material | T.Texture>();
  const hidden = new Set<T.BufferGeometry | T.Material | T.Texture>();
  function visit(node: T.Object3D, parentVisible: boolean) {
    const shown = parentVisible && node.visible;
    const resources = shown ? visible : hidden;
    if (
      node instanceof T.Mesh ||
      node instanceof T.Line ||
      node instanceof T.Points ||
      node instanceof T.Sprite
    ) {
      if ('geometry' in node) resources.add(node.geometry);
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        resources.add(material);
        for (const value of Object.values(material))
          if (value instanceof T.Texture) resources.add(value);
      }
    }
    node.children.forEach((child) => visit(child, shown));
  }
  visit(scene, true);
  hidden.forEach((resource) => {
    if (!visible.has(resource)) resource.dispose();
  });
}
