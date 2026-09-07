import * as T from 'three';
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/addons/renderers/CSS3DRenderer.js';

// The native player is placed behind WebGL. A depth-writing, zero-alpha screen
// reveals it only at the actual TV panel; furniture still occludes the picture.
// This also keeps YouTube's official player, controls and captions intact.
export function televisionScreen(
  host: HTMLElement,
  screen: T.Mesh,
  dimensions = {
    width: 4.12,
    height: 2.3175,
    pixelsWidth: 1280,
    pixelsHeight: 720,
  },
) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.className = 'tv-spatial-layer';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  let original = screen.material;
  const aperture = new T.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    blending: T.NoBlending,
    depthWrite: true,
    side: T.FrontSide,
  });
  let object: CSS3DObject | null = null,
    enabled = false;
  const scale = new T.Matrix4().makeScale(
    dimensions.width / dimensions.pixelsWidth,
    dimensions.height / dimensions.pixelsHeight,
    1,
  );
  const point = new T.Vector3(),
    normal = new T.Vector3(),
    eye = new T.Vector3();
  return {
    setBaseMaterial(material: T.Material | T.Material[]) {
      original = material;
      if (!object) screen.material = material;
    },
    set(element: HTMLElement | null) {
      if (object) scene.remove(object);
      object = element ? new CSS3DObject(element) : null;
      if (object) {
        object.matrixAutoUpdate = false;
        scene.add(object);
      }
      screen.material = object ? aperture : original;
    },
    resize(width: number, height: number) {
      renderer.setSize(width, height);
    },
    update(camera: T.Camera) {
      if (!object) return;
      screen.updateWorldMatrix(true, false);
      let visible = true;
      for (let p: T.Object3D | null = screen; p; p = p.parent)
        if (!p.visible) visible = false;
      screen.getWorldPosition(point);
      normal.set(0, 0, 1).transformDirection(screen.matrixWorld);
      camera.getWorldPosition(eye);
      visible = visible && normal.dot(eye.sub(point)) > 0.05;
      object.visible = visible;
      enabled = visible;
      if (object.element.inert === visible) object.element.inert = !visible;
      object.element.style.pointerEvents = visible ? 'auto' : 'none';
      object.matrix.copy(screen.matrixWorld).multiply(scale);
      renderer.render(scene, camera);
    },
    get active() {
      return enabled;
    },
    dispose() {
      if (object) scene.remove(object);
      screen.material = original;
      aperture.dispose();
      renderer.domElement.remove();
    },
  };
}
