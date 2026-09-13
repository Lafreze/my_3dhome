import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import {
  loadAssetGltf,
  loadingManager,
  releaseAssetTexture,
  setAssetRenderer,
} from './asset-loading';
import { assetUrl } from './asset-url';
import type { Exhibit } from './exhibit-data';

export function disposeModel(root: T.Object3D) {
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometry.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const t of Object.values(m))
          if (t instanceof T.Texture) textures.add(t);
      }
    }
  });
  geometry.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach(releaseAssetTexture);
}
export function createModelViewer(
  host: HTMLElement,
  changed: (state: {
    loading: boolean;
    error: string;
    triangles?: number;
  }) => void,
) {
  const scene = new T.Scene();
  scene.background = new T.Color('#262d32');
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute(
    'aria-label',
    '三维模型画面，拖动旋转，滚轮缩放',
  );
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  setAssetRenderer(renderer);
  const camera = new T.PerspectiveCamera(38, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minDistance = 0.75;
  controls.maxDistance = 18;
  controls.autoRotateSpeed = 0.75;
  controls.target.set(0, 1.45, 0);
  controls.enableZoom = true;
  const pmrem = new T.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.75;
  room.dispose();
  pmrem.dispose();
  scene.add(new T.HemisphereLight('#edf5ff', '#77705f', 2));
  const key = new T.DirectionalLight('#fff0d9', 3.1);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new T.DirectionalLight('#b8d6ff', 2.0);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
  const fill = new T.DirectionalLight('#ffffff', 1.4);
  fill.position.set(-3, 1, 4);
  scene.add(fill);
  const stage = new T.Mesh(
    new T.CircleGeometry(2.8, 96),
    new T.MeshBasicMaterial({ color: '#30393e' }),
  );
  stage.rotation.x = -Math.PI / 2;
  stage.position.y = -0.025;
  scene.add(stage);
  const rings = new T.Group();
  scene.add(rings);
  for (const r of [1.8, 2.25, 2.75]) {
    const ring = new T.Mesh(
      new T.RingGeometry(r, r + 0.009, 96),
      new T.MeshBasicMaterial({ color: '#4c575d', side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.018;
    rings.add(ring);
  }
  let active: T.Group | undefined,
    disposed = false,
    frame = 0,
    revision = 0,
    dirty = true,
    auto = false,
    lastTime = performance.now(),
    abort: AbortController | undefined;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mark = () => {
    dirty = true;
  };
  controls.addEventListener('change', mark);
  function fit() {
    const bounds = active
      ? new T.Box3().setFromObject(active)
      : new T.Box3(new T.Vector3(-1, 0, -1), new T.Vector3(1, 3, 1));
    const target = bounds.getCenter(new T.Vector3()),
      radius = bounds.getSize(new T.Vector3()).length() / 2;
    const halfFov = Math.atan(
      Math.tan(T.MathUtils.degToRad(camera.fov / 2)) *
        Math.min(1, camera.aspect),
    );
    const distance = (radius / Math.sin(halfFov)) * 1.12;
    camera.position
      .copy(target)
      .add(new T.Vector3(0.42, 0.22, 1).normalize().multiplyScalar(distance));
    controls.target.copy(target);
    controls.update();
    controls.saveState();
    dirty = true;
  }
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    fit();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const lost = (e: Event) => {
    e.preventDefault();
    changed({ loading: false, error: '画面暂时中断，请重新载入模型。' });
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  function animate(time: number) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    if (document.hidden) return;
    controls.autoRotate = auto && !reduced.matches;
    const moving = controls.update(dt);
    if (dirty || moving || controls.autoRotate) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }
  frame = requestAnimationFrame(animate);
  async function uploaded(item: Exhibit, signal: AbortSignal) {
    if (
      !item.url ||
      !/^\/api\/(?:models\/[a-f0-9-]{36}\.glb|model-share\/[A-Za-z0-9_-]{43}\/file\.glb)$/.test(
        item.url,
      )
    )
      throw Error('模型地址无效。');
    const response = await fetch(item.url, {
      signal,
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw Error('模型文件暂时无法读取。');
    const bytes = await response.arrayBuffer();
    const loader = new GLTFLoader(loadingManager),
      draco = new DRACOLoader(loadingManager).setDecoderPath(
        assetUrl('decoders/draco/'),
      );
    const basis = new KTX2Loader(loadingManager)
      .setTranscoderPath(assetUrl('decoders/basis/'))
      .detectSupport(renderer);
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(basis);
    const d = new DataView(bytes),
      json = JSON.parse(
        new TextDecoder().decode(bytes.slice(20, 20 + d.getUint32(12, true))),
      );
    if (json.extensionsUsed?.includes('EXT_meshopt_compression')) {
      const url = assetUrl('decoder.meshopt');
      const decoderModule = await import(/* @vite-ignore */ url);
      loader.setMeshoptDecoder(decoderModule.MeshoptDecoder);
    }
    try {
      return await loader.parseAsync(bytes, '');
    } finally {
      draco.dispose();
      basis.dispose();
    }
  }
  if (['localhost', '127.0.0.1'].includes(location.hostname))
    Object.assign(window, {
      __kuroModelViewer: {
        snapshot: () => ({
          modelId: host.dataset.modelId,
          camera: camera.position.toArray(),
          target: controls.target.toArray(),
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        }),
      },
    });
  return {
    async select(item: Exhibit) {
      const current = ++revision;
      host.dataset.modelId = '';
      host.dataset.modelStatus = 'loading';
      abort?.abort();
      abort = new AbortController();
      changed({ loading: true, error: '' });
      if (active) {
        scene.remove(active);
        disposeModel(active);
        active = undefined;
      }
      dirty = true;
      try {
        const gltf = item.assetId
          ? await loadAssetGltf(item.assetId)
          : await uploaded(item, abort.signal);
        if (disposed || current !== revision) {
          disposeModel(gltf.scene);
          return;
        }
        const model = gltf.scene,
          bounds = new T.Box3().setFromObject(model),
          size = bounds.getSize(new T.Vector3()),
          center = bounds.getCenter(new T.Vector3());
        if (!Number.isFinite(size.length()) || size.length() < 0.00001) {
          disposeModel(model);
          throw Error('模型没有可显示的几何。');
        }
        const scale = 3 / Math.max(size.x, size.y, size.z);
        model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
        active = new T.Group();
        active.add(model);
        active.scale.setScalar(scale);
        scene.add(active);
        let triangles = 0;
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            triangles +=
              (o.geometry.index?.count ||
                o.geometry.getAttribute('position').count) / 3;
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              for (const v of Object.values(m))
                if (v instanceof T.Texture) v.anisotropy = 8;
          }
        });
        const finalBounds = new T.Box3().setFromObject(active);
        controls.target.y = finalBounds.getSize(new T.Vector3()).y / 2;
        fit();
        renderer.render(scene, camera);
        host.dataset.modelId = item.id;
        host.dataset.modelStatus = 'ready';
        changed({
          loading: false,
          error: '',
          triangles: Math.round(triangles),
        });
        dirty = true;
      } catch (error) {
        if (!disposed && current === revision)
          changed({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : '模型暂时无法打开，请重试。',
          });
      }
    },
    rotate(angle: number) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new T.Vector3(0, 1, 0), angle);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      dirty = true;
    },
    zoom(factor: number) {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(
        T.MathUtils.clamp(
          offset.length() * factor,
          controls.minDistance,
          controls.maxDistance,
        ),
      );
      camera.position.copy(controls.target).add(offset);
      controls.update();
      dirty = true;
    },
    reset: fit,
    auto(value: boolean) {
      auto = value;
      dirty = true;
    },
    capture() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      disposed = true;
      delete (window as Window & { __kuroModelViewer?: unknown })
        .__kuroModelViewer;
      revision++;
      abort?.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      if (active) disposeModel(active);
      disposeModel(stage);
      disposeModel(rings);
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      setAssetRenderer(undefined);
    },
  };
}
export type ModelViewer = ReturnType<typeof createModelViewer>;
