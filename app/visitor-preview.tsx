'use client';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { humanScale } from './character-scale.mjs';
import { pillowGeometry } from './bed-linen';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  acquireVisitorModel,
  partVisible,
  type VisitorPart,
  configureVisitorTint,
} from './visitor-model';
import type { Appearance } from './visitor-appearance';
import {
  configureVisitorMotion,
  sampleVisitorMotion,
  visitorSeed,
} from './visitor-motion';

export default function VisitorPreview({
  appearance,
  posture = 'sit',
}: {
  appearance: Appearance;
  posture?: 'sit' | 'rest';
}) {
  const host = useRef<HTMLDivElement>(null);
  const apply = useRef<((value: Appearance) => void) | null>(null);
  const latest = useRef(appearance);
  const latestPosture = useRef(posture);
  useEffect(() => {
    latestPosture.current = posture;
    apply.current?.(latest.current);
  }, [posture]);
  const [status, setStatus] = useState('正在整理衣橱…');
  useEffect(() => {
    latest.current = appearance;
    apply.current?.(appearance);
  }, [appearance]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    queueMicrotask(() => setStatus('正在整理衣橱…'));
    let renderedPosture: 'sit' | 'rest' | undefined;
    let stopped = false,
      release: (() => void) | undefined,
      frame = 0;
    const scene = new T.Scene();
    const meshes: { mesh: T.Mesh; part: VisitorPart }[] = [];
    const ownedMaterials: T.Material[] = [];
    const motion = { value: new T.Vector4(0, 0, 0, 0) };
    const resting = { value: 0 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() => setStatus('预览暂时无法打开，仍可选择并保存外观'));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x000000, 0);
    element.appendChild(renderer.domElement);
    const camera = new T.PerspectiveCamera(32, 1, 0.05, 30);
    camera.position.set(1.1, 0.8, 2.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.42, 0.12);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 1.6;
    controls.maxDistance = 4.5;
    controls.minPolarAngle = 0.75;
    controls.maxPolarAngle = 1.7;
    controls.update();
    scene.add(new T.HemisphereLight(0xfff7ea, 0x73624c, 2));
    const key = new T.DirectionalLight(0xfff3df, 3);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const fill = new T.DirectionalLight(0xe4edff, 1.2);
    fill.position.set(3, 2, 1);
    scene.add(fill);
    const rim = new T.DirectionalLight(0xffddbd, 2);
    rim.position.set(1, 3, -3);
    scene.add(rim);
    const stoolMaterial = new T.MeshStandardMaterial({
      color: '#ae8e68',
      roughness: 0.8,
    });
    const stoolGeometry = new T.CylinderGeometry(0.29, 0.28, 0.07, 48);
    const stool = new T.Mesh(stoolGeometry, stoolMaterial);
    const support = new T.Group();
    scene.add(support);
    stool.position.set(0, -0.04, -0.005);
    support.add(stool);
    const legGeometry = new T.CylinderGeometry(0.021, 0.028, 0.65, 12);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.17, 0.17]) {
        const leg = new T.Mesh(legGeometry, stoolMaterial);
        leg.position.set(x, -0.39, z);
        support.add(leg);
      }
    const bedGeometry = new T.BoxGeometry(1.24, 0.08, 1.88);
    const bedMaterial = new T.MeshStandardMaterial({
      color: '#e6e0ce',
      roughness: 0.95,
    });
    const bed = new T.Mesh(bedGeometry, bedMaterial);
    bed.position.set(0, -0.05, -0.12);
    scene.add(bed);
    bed.visible = false;
    const previewPillowGeometry = pillowGeometry(0.9, 0.16, 0.51);
    const pillow = new T.Mesh(previewPillowGeometry, bedMaterial);
    pillow.position.set(0, 0.14, -0.62);
    bed.add(pillow);
    function render() {
      if (!stopped) renderer.render(scene, camera);
    }
    function animate(now: number) {
      if (stopped) return;
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      sampleVisitorMotion(
        (now - started) / 1000,
        visitorSeed(`preview/${latest.current.character}`),
        reduced.matches,
        motion.value,
      );
      resting.value = latestPosture.current === 'rest' ? 1 : 0;
      if (renderedPosture !== latestPosture.current) {
        renderedPosture = latestPosture.current;
        if (resting.value) camera.position.set(1.3, 1.65, 2.7);
        else camera.position.set(1.1, 0.8, 2.2);
        controls.minPolarAngle = resting.value ? 0.18 : 0.75;
      }
      support.visible = !resting.value;
      bed.visible = !!resting.value;
      if (resting.value)
        motion.value.set(
          1,
          0,
          reduced.matches ? 0 : Math.sin((now - started) / 850) * 0.0018,
          0,
        );
      if (resting.value) controls.target.set(0, 0.23, 0);
      else controls.target.set(0, 0.42, 0.12);
      controls.update();
      render();
    }
    function resize() {
      const { width, height } = element!.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    controls.addEventListener('change', render);
    apply.current = (a) => {
      for (const { mesh, part } of meshes) {
        mesh.visible = partVisible(part, a, latestPosture.current);
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        if (part.tint)
          for (const m of mats)
            if (m instanceof T.MeshStandardMaterial) {
              const source = Array.isArray(part.material)
                ? part.material[0]
                : part.material;
              if (source instanceof T.MeshStandardMaterial)
                m.color.set(a[part.tint]);
            }
      }
      render();
    };
    void acquireVisitorModel([appearance.character])
      .then(({ parts, release: free }) => {
        if (stopped) {
          free();
          return;
        }
        release = free;
        for (const part of parts) {
          const material = Array.isArray(part.material)
            ? part.material.map((m) => m.clone())
            : part.material.clone();
          for (const m of Array.isArray(material) ? material : [material]) {
            if (part.tint) configureVisitorTint(m, part.character, part.tint);
            configureVisitorMotion(
              m,
              part.character,
              motion,
              false,
              part.eyelid,
              resting,
            );
          }
          ownedMaterials.push(
            ...(Array.isArray(material) ? material : [material]),
          );
          const mesh = new T.Mesh(part.geometry, material);
          mesh.frustumCulled = false;
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(part.matrix);
          mesh.matrix.premultiply(
            new T.Matrix4().makeScale(
              humanScale(part.character),
              humanScale(part.character),
              humanScale(part.character),
            ),
          );
          mesh.name = part.name;
          scene.add(mesh);
          meshes.push({ mesh, part });
        }
        apply.current?.(latest.current);
        setStatus('');
        // Render once more after the canvas has received its final dialog dimensions.
        resize();
        frame = requestAnimationFrame(animate);
      })
      .catch(() => {
        if (!stopped) setStatus('人物加载失败，请关闭后重试');
      });
    return () => {
      stopped = true;
      apply.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      ownedMaterials.forEach((m) => m.dispose());
      release?.();
      stoolGeometry.dispose();
      legGeometry.dispose();
      stoolMaterial.dispose();
      bedGeometry.dispose();
      previewPillowGeometry.dispose();
      bedMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [appearance.character]);
  return (
    <figure
      className="visitor-preview"
      aria-label="小人外观实时预览，可拖动旋转和缩放"
    >
      <div className="visitor-preview-canvas" ref={host} />
      {status && <output className="visitor-preview-status">{status}</output>}
    </figure>
  );
}
