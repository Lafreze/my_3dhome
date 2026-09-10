import * as T from 'three';
import { LifeEngine } from './life-engine';
import { rememberLifeStarts, type LifeSession } from './life-session';
export { loadLifeSession } from './life-session';
import { attachResident, residentAssetId } from './resident-model';
import { catAssetId, loadCatVisual } from './cat-model';
import { rabbitAssetId, attachRabbit } from './rabbit-model';
import type { RoomAssets } from './asset-loading';
import { createActorModel, type ActorModel } from './life-models';
import { createCollectionStore } from './life-collections';
import {
  collectionCards,
  type ActorId,
  type Point,
  type CollectionData,
} from './life-data';
import type { Environment } from './environment-data';
import { type HouseView, type RoomId } from './house-data';
import type { Visitor } from './seat-data';
import type { SeatAnchors } from './seat-scene';
import type { interiorAtmosphere } from './interior-atmosphere';
import type { ObjectId } from './room-data';

type Options = {
  assets: RoomAssets;
  renderer: T.WebGLRenderer;
  groups: Map<ObjectId, T.Group>;
  scene: T.Scene;
  roots: Record<RoomId, T.Group>;
  camera: T.Camera;
  interactables: T.Object3D[];
  seats: SeatAnchors;
  visitors: Visitor[];
  cat: ReturnType<typeof interiorAtmosphere>;
  coffee: () => void;
  bubble: (text: string) => void;
  collections: (data: CollectionData, message: string) => void;
};
export function createLifeScene(k: Options, session: LifeSession) {
  const models = new Map<ActorId, ActorModel>();
  const poseClock = new Map<ActorId, { dt: number; state: string }>();
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  for (const id of ['resident', 'rabbit', 'bird', 'robot'] as const) {
    const model = createActorModel(id);
    models.set(id, model);
    k.scene.add(model.root);
    k.interactables.push(model.root);
  }
  k.interactables.push(k.cat.cat);
  // Charging pad sits against the café's open perimeter, outside the bedroom/bar restrictions.
  const dock = new T.Group();
  dock.position.set(1.5, 0.09, 17.65);
  k.scene.add(dock);
  const dockGeo = new T.CylinderGeometry(0.3, 0.3, 0.025, 24),
    dockMat = new T.MeshStandardMaterial({ color: '#716f61', roughness: 0.8 });
  dock.add(new T.Mesh(dockGeo, dockMat));
  const pickup = new T.Group();
  pickup.position.set(1.82, 1.555, 12.7);
  k.scene.add(pickup);
  pickup.visible = false;
  const cupGeo = new T.CylinderGeometry(0.085, 0.062, 0.14, 20, 1, true),
    cupMat = new T.MeshStandardMaterial({
      color: '#eee6d8',
      roughness: 0.7,
      side: T.DoubleSide,
    });
  const cupMesh = new T.Mesh(cupGeo, cupMat);
  cupMesh.position.y = 0.09;
  pickup.add(cupMesh);
  const saucerGeo = new T.CylinderGeometry(0.14, 0.11, 0.017, 20);
  pickup.add(new T.Mesh(saucerGeo, cupMat));
  let pickupAt = Infinity,
    pickupUntil = 0;
  let audio: AudioContext | null = null,
    hum: OscillatorNode | null = null,
    humGain: GainNode | null = null,
    disposed = false,
    paused = false,
    view: HouseView = 'study',
    reduced = false;
  void k.assets.register('shared', residentAssetId, () =>
    attachResident(models.get('resident')!, () => !disposed),
  )();
  void k.assets.register('shared', catAssetId, async () => {
    const visual = await loadCatVisual(() => !disposed);
    if (visual) k.cat.attachVisual(visual);
  })();
  void k.assets.register('shared', rabbitAssetId, () =>
    attachRabbit(models.get('rabbit')!, () => !disposed),
  )();
  const tones = new Set<{ osc: OscillatorNode; gain: GainNode }>();
  const sound = (kind: string, point: Point) => {
    if (!audio || audio.state !== 'running' || paused || document.hidden)
      return;
    const d = k.camera.position.distanceTo(new T.Vector3(...point)),
      volume = 0.025 / (1 + (d * d) / 18);
    const osc = audio.createOscillator(),
      gain = audio.createGain(),
      now = audio.currentTime;
    const pitch: Record<string, number> = {
      cat: 430,
      hop: 105,
      bird: 1700,
      wings: 175,
      cup: 920,
    };
    osc.frequency.setValueAtTime(pitch[kind] || 200, now);
    osc.frequency.exponentialRampToValueAtTime(
      (pitch[kind] || 200) * (kind === 'bird' ? 1.4 : 0.65),
      now + 0.22,
    );
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(now + 0.3);
    const voice = { osc, gain };
    tones.add(voice);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      tones.delete(voice);
    };
  };
  const collections = createCollectionStore((id, data, saved) =>
    k.collections(
      data,
      `${collectionCards[id].title}${saved ? '' : ' · 本次访问已记下'}`,
    ),
  );
  const visitorFootprints = (people: Visitor[]) =>
    people.flatMap((p) => {
      const anchor = k.seats.get(p.seatId);
      if (!anchor) return [];
      anchor.updateWorldMatrix(true, false);
      return [
        {
          id: p.id,
          seatId: p.seatId,
          position: anchor.getWorldPosition(new T.Vector3()).toArray() as Point,
        },
      ];
    });
  const engine = new LifeEngine(
    session.seed,
    {
      collect: (...args) => collections.collect(...args),
      bubble: (_actor, text) => k.bubble(text),
      sound,
      coffee: (atPickup) => {
        if (atPickup) {
          pickupAt = engine.clock + 3;
          pickupUntil = engine.clock + 45;
          sound('cup', [1.82, 1.555, 12.7]);
        } else k.coffee();
      },
    },
    session.previous,
    visitorFootprints(k.visitors),
  );
  rememberLifeStarts(
    Object.fromEntries(Object.values(engine.actors).map((a) => [a.id, a.node])),
  );
  const stopHum = () => {
    if (hum) {
      hum.stop();
      hum.disconnect();
      hum = null;
    }
    humGain?.disconnect();
    humGain = null;
  };
  const visibility = () => {
    if (document.hidden) {
      stopHum();
      tones.forEach((v) => {
        try {
          v.osc.stop();
        } catch {
          /* already ended */
        }
      });
    }
  };
  document.addEventListener('visibilitychange', visibility);
  function setAudio(context: AudioContext | null) {
    stopHum();
    audio = context;
  }
  function click(id: ActorId) {
    engine.interact(id, k.camera.position.toArray() as Point);
  }
  let diagnosticEnabled = true;
  function update(dt: number, environment: Environment) {
    if (disposed || document.hidden) return;
    if (!diagnosticEnabled) {
      models.forEach((m) => (m.root.visible = false));
      dock.visible = false;
      k.cat.setCatDirective(null);
      return;
    }
    dock.visible = view === 'cafe' || view === 'overview';
    engine.update(dt, { view, environment, reduced, paused });
    pickup.visible =
      (view === 'cafe' || view === 'overview') &&
      engine.clock >= pickupAt &&
      engine.clock < pickupUntil;
    if (paused) {
      stopHum();
      return;
    }
    for (const a of Object.values(engine.actors)) {
      const model = models.get(a.id),
        position = new T.Vector3(...a.position);
      let rotation = a.rotation;
      if (a.seated) {
        const seat = engine.node(a.node).seatId,
          anchor = seat && k.seats.get(seat);
        if (anchor) {
          anchor.updateWorldMatrix(true, false);
          anchor.getWorldPosition(position);
          const forward = new T.Vector3(0, 0, 1).applyQuaternion(
            anchor.getWorldQuaternion(new T.Quaternion()),
          );
          rotation = Math.atan2(forward.x, forward.z) + Math.PI;
        }
      }
      if (a.id === 'cat') {
        const target =
          a.fsm.state === 'watchBird'
            ? engine.actors.bird
            : a.fsm.state === 'watchRabbit'
              ? engine.actors.rabbit
              : undefined;
        k.cat.setCatDirective({
          position: a.position,
          rotation: a.rotation,
          room: a.room,
          state: a.fsm.state,
          visible: a.visible,
          animationTime: a.animationTime,
          travelDistance: a.travelDistance,
          turnDistance: a.turnDistance,
          navigating: a.path.length > 0,
          lookAt: target?.position,
        });
        continue;
      }
      if (!model) continue;
      model.root.visible = a.visible;
      model.root.position.copy(position);
      const delta = Math.atan2(
        Math.sin(rotation - model.root.rotation.y),
        Math.cos(rotation - model.root.rotation.y),
      );
      model.root.rotation.y += reduced
        ? delta
        : delta * (1 - Math.exp(-dt * 6));
      if (!a.visible) continue;
      if (a.id === 'bird') {
        const n = engine.node(a.node),
          phase =
            a.fsm.state === 'land'
              ? Math.max(0, 1 - a.fsm.elapsed / 3)
              : a.fsm.state === 'takeOff'
                ? Math.min(1, a.fsm.elapsed / 3)
                : 0;
        // Fly entirely on the exterior side of each sill using a fixed quadratic arc.
        const outward = new T.Vector3(
          n.room === 'bedroom' ? -1 : n.room === 'living' ? 1 : 0,
          0,
          n.room === 'study' ? -1 : n.room === 'cafe' ? 1 : 0,
        );
        const control = position
          .clone()
          .addScaledVector(outward, 2.2)
          .add(new T.Vector3(0, 1.1, 0));
        const end = position
          .clone()
          .addScaledVector(outward, 5)
          .add(new T.Vector3(0, 1.9, 0));
        model.root.position.copy(
          new T.QuadraticBezierCurve3(position, control, end).getPoint(phase),
        );
        const windowId = n.interactionTarget,
          windowGroup = k.groups.get(windowId as ObjectId);
        let hidden = false;
        for (
          let parent: T.Object3D | null = windowGroup ?? null;
          parent;
          parent = parent.parent
        )
          if (!parent.visible) hidden = true;
        if (hidden) {
          engine.birdWitness = false;
          model.root.visible = false;
        }
      }
      const pose = poseClock.get(a.id) ?? { dt: 1, state: '' };
      pose.dt += dt;
      const distant = k.camera.position.distanceTo(model.root.position) > 12;
      if (
        pose.state !== a.fsm.state ||
        pose.dt >= (distant ? 1 / 20 : mobile ? 1 / 30 : 1 / 60)
      ) {
        const duck =
          a.id === 'rabbit' &&
          a.room === 'gallery' &&
          a.position[0] > 6.4 &&
          a.position[0] < 9.35 &&
          a.position[2] > 8.3 &&
          a.position[2] < 9.5;
        model.animate(
          a.fsm.state,
          a.animationTime,
          pose.dt,
          reduced,
          a.seated,
          { hopTime: a.hopTime, moving: a.path.length > 0, crouched: duck },
        );
        pose.dt = 0;
        pose.state = a.fsm.state;
      }
      poseClock.set(a.id, pose);
      if (a.id === 'rabbit')
        model.root.scale.setScalar(
          0.55 *
            (a.fsm.state === 'hide'
              ? Math.max(0.02, 1 - a.fsm.elapsed / 4)
              : Math.min(1, 0.65 + a.animationTime * 0.23)),
        );
      // Budget: at most the nearby resident casts real-time shadows; every secondary has a blob.
      const cast =
        !mobile &&
        a.id === 'resident' &&
        k.camera.position.distanceTo(model.root.position) < 9;
      model.root.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = cast;
      });
    }
    const robot = engine.actors.robot;
    if (
      audio?.state === 'running' &&
      robot.visible &&
      robot.path.length &&
      !reduced
    ) {
      if (!hum) {
        hum = audio.createOscillator();
        humGain = audio.createGain();
        hum.frequency.value = 64;
        hum.connect(humGain);
        humGain.connect(audio.destination);
        hum.start();
      }
      const d = k.camera.position.distanceTo(new T.Vector3(...robot.position));
      humGain!.gain.setTargetAtTime(
        0.008 / (1 + (d * d) / 16),
        audio.currentTime,
        0.2,
      );
    } else stopHum();
  }
  const debug = {
    engine,
    screenPosition(id: ActorId) {
      const object = id === 'cat' ? k.cat.cat : models.get(id)?.root;
      if (!object) return null;
      object.updateWorldMatrix(true, true);
      const point = new T.Box3()
          .setFromObject(object)
          .getCenter(new T.Vector3())
          .project(k.camera),
        rect = k.renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + ((point.x + 1) * rect.width) / 2,
        y: rect.top + ((1 - point.y) * rect.height) / 2,
        visible: object.visible,
      };
    },
    setEnabled(value: boolean) {
      diagnosticEnabled = value;
    },
    snapshot: () => ({
      ...engine.snapshot(),
      seedSource: session.source,
      serverTime: session.serverTime,
      catPose: k.cat.catPose(),
      render: { ...k.renderer.info.render },
      memory: { ...k.renderer.info.memory },
      models: Object.fromEntries(
        [...models].map(([id, m]) => [
          id,
          {
            triangles: m.triangles,
            downloadBytes: m.root.userData.downloadBytes ?? 0,
            bones: m.root.userData.bones ?? 0,
          },
        ]),
      ),
    }),
    setView: (v: HouseView) => {
      view = v;
    },
  };
  if (['localhost', '127.0.0.1'].includes(location.hostname))
    Object.assign(window, { __kuroLife: debug });
  return {
    update,
    click,
    setAudio,
    setPaused(value: boolean) {
      paused = value;
    },
    setView(value: HouseView) {
      view = value;
    },
    setReduced(value: boolean) {
      reduced = value;
    },
    setVisitors(people: Visitor[]) {
      engine.setVisitors(visitorFootprints(people));
    },
    claimCoffee() {
      return engine.events.start(
        'coffee',
        'resident',
        engine.clock,
        14,
        18,
        true,
      );
    },
    snapshot: debug.snapshot,
    occupiedSeat: () =>
      engine.actors.resident.active && engine.actors.resident.seated
        ? engine.node(engine.actors.resident.node).seatId
        : undefined,
    dispose() {
      disposed = true;
      stopHum();
      tones.forEach((v) => {
        try {
          v.osc.stop();
        } catch {
          /* ended */
        }
        v.osc.disconnect();
        v.gain.disconnect();
      });
      document.removeEventListener('visibilitychange', visibility);
      k.cat.setCatDirective(null);
      k.cat.releaseVisual();
      for (const m of models.values()) {
        const i = k.interactables.indexOf(m.root);
        if (i >= 0) k.interactables.splice(i, 1);
        m.dispose();
      }
      const i = k.interactables.indexOf(k.cat.cat);
      if (i >= 0) k.interactables.splice(i, 1);
      dockGeo.dispose();
      dockMat.dispose();
      dock.removeFromParent();
      cupGeo.dispose();
      cupMat.dispose();
      saucerGeo.dispose();
      pickup.removeFromParent();
      if (['localhost', '127.0.0.1'].includes(location.hostname))
        delete (window as Window & { __kuroLife?: unknown }).__kuroLife;
    },
  };
}
export type LifeScene = ReturnType<typeof createLifeScene>;
