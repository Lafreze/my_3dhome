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
  const sample = document.createElement('canvas');
  sample.width = sample.height = 8;
  let sampleContext = sample.getContext('2d', { willReadFrequently: true });
  let lastSample = -Infinity,
    blockedSource = '';
  const sampledColor = new T.Color('#a3bbc7');
  return {
    sampleColor(target: T.Color, time: number) {
      const video = object?.element.querySelector('video');
      if (
        !video ||
        video.readyState < 2 ||
        !video.currentSrc ||
        video.currentSrc === blockedSource ||
        !sampleContext
      )
        return false;
      if (time - lastSample >= 0.5) {
        lastSample = time;
        try {
          sampleContext.drawImage(video, 0, 0, 8, 8);
          const pixels = sampleContext.getImageData(0, 0, 8, 8).data;
          let r = 0,
            g = 0,
            b = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
          }
          sampledColor.setRGB(
            r / 16320,
            g / 16320,
            b / 16320,
            T.SRGBColorSpace,
          );
        } catch {
          // Cross-origin players retain their native playback and use a quiet neutral glow.
          blockedSource = video.currentSrc;
          sample.width = 8;
          sampleContext = sample.getContext('2d', { willReadFrequently: true });
          return false;
        }
      }
      target.copy(sampledColor);
      return true;
    },
    setBaseMaterial(material: T.Material | T.Material[]) {
      original = material;
      if (!object) screen.material = material;
    },
    set(element: HTMLElement | null) {
      blockedSource = '';
      lastSample = -Infinity;
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
    update(camera: T.Camera, interactive = true) {
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
      const acceptsInput = visible && interactive;
      if (object.element.inert === acceptsInput)
        object.element.inert = !acceptsInput;
      object.element.style.pointerEvents = acceptsInput ? 'auto' : 'none';
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
