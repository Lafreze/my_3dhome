import { seatedHand, heldHand } from './visitor-hand-poses';
import type { Character } from './visitor-appearance';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { visitorSeed } from './visitor-motion';
import type { Visitor } from './seat-data';
export function sampleSeatedActivity(
  visitor: Visitor,
  t: number,
  reduced: boolean,
) {
  if (reduced || visitor.posture === 'rest') return { kind: 0, amount: 0 };
  const gesture = visitor.gesture,
    now = Date.now();
  let kind = 0,
    age = 0,
    duration = 7;
  if (
    gesture &&
    now < gesture.expiresAt &&
    ['phone', 'coffee'].includes(gesture.kind)
  ) {
    kind = gesture.kind === 'phone' ? 1 : 2;
    age = (now - gesture.at) / 1000;
    duration = 10;
  } else {
    const seed = visitorSeed(visitor.id),
      cycle = t + (seed % 43);
    age = (cycle % 48) - 32;
    kind = (Math.floor(cycle / 48 + seed) % 2) + 1;
  }
  if (age < 0 || age > duration) return { kind: 0, amount: 0 };
  const smooth = (v: number) => {
    v = Math.max(0, Math.min(1, v));
    return v * v * (3 - 2 * v);
  };
  return { kind, amount: smooth(age / 1.5) * smooth((duration - age) / 1.6) };
}
export function createVisitorProps() {
  const root = new T.Group(),
    phone = new T.Group(),
    cup = new T.Group();
  root.add(phone, cup);
  root.name = 'Seated phone and coffee';
  const dark = new T.MeshStandardMaterial({
    color: '#292d30',
    roughness: 0.48,
    metalness: 0.12,
  });
  const screen = new T.MeshStandardMaterial({
    color: '#d1dccd',
    emissive: '#91aca0',
    emissiveIntensity: 0.16,
    roughness: 0.35,
  });
  const ceramic = new T.MeshStandardMaterial({
    color: '#f2e9dc',
    roughness: 0.29,
  });
  const coffee = new T.MeshStandardMaterial({
    color: '#624735',
    roughness: 0.32,
  });
  const body = new T.Mesh(
    new RoundedBoxGeometry(0.095, 0.17, 0.013, 2, 0.01),
    dark,
  );
  phone.add(body);
  const display = new T.Mesh(new T.PlaneGeometry(0.08, 0.138), screen);
  display.position.z = 0.007;
  phone.add(display);
  const mug = new T.Mesh(
    new T.LatheGeometry(
      [
        new T.Vector2(0, 0),
        new T.Vector2(0.041, 0),
        new T.Vector2(0.053, 0.088),
        new T.Vector2(0.047, 0.091),
        new T.Vector2(0.043, 0.012),
        new T.Vector2(0, 0.012),
      ],
      24,
    ),
    ceramic,
  );
  cup.add(mug);
  const handle = new T.Mesh(new T.TorusGeometry(0.025, 0.007, 6, 16), ceramic);
  handle.position.set(0.061, 0.052, 0);
  cup.add(handle);
  const liquid = new T.Mesh(new T.CircleGeometry(0.046, 24), coffee);
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.077;
  cup.add(liquid);
  return {
    root,
    update(kind: number, amount: number, neck: number, character: Character) {
      phone.visible = kind === 1 && amount > 0.015;
      cup.visible = kind === 2 && amount > 0.015;
      const start = seatedHand[character],
        end = heldHand(character, neck, kind),
        p = start.map((v, i) => T.MathUtils.lerp(v, end[i], amount));
      phone.position.set(p[0] + 0.043, p[1] + 0.066, p[2] + 0.012);
      phone.rotation.x = -0.4;
      cup.position.set(p[0] + 0.053, p[1] - 0.046, p[2]);
      cup.rotation.y = Math.PI;
      cup.rotation.x = -amount * 0.1;
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      [dark, screen, ceramic, coffee].forEach((m) => m.dispose());
    },
  };
}
