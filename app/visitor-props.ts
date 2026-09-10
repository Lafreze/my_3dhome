import { floatingCupPosition, floatingPhonePose } from './visitor-hand-poses';
import type { Character } from './visitor-appearance';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createVisitorProps() {
  const root = new T.Group(),
    phone = new T.Group(),
    cup = new T.Group();
  root.add(phone, cup);
  root.name = 'Seated phone and coffee';
  phone.name = 'Phone / screen toward eyes';
  cup.name = 'Cup / floating gesture';
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
  const lens = new T.Mesh(new T.CircleGeometry(0.008, 12), screen);
  lens.rotation.y = Math.PI;
  lens.position.set(-0.027, 0.064, -0.007);
  phone.add(lens);
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
  let configuredCharacter: Character | undefined;
  return {
    root,
    update(kind: number, amount: number, character: Character) {
      phone.visible = kind === 1 && amount > 0.015;
      cup.visible = kind === 2 && amount > 0.015;
      phone.scale.setScalar(amount);
      cup.scale.setScalar(amount);
      if (configuredCharacter === character) return;
      configuredCharacter = character;
      const pose = floatingPhonePose(character);
      phone.position.copy(pose.position);
      phone.quaternion.copy(pose.quaternion);
      cup.position.copy(floatingCupPosition(character));
      cup.rotation.set(0, Math.PI, 0);
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
