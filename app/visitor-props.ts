import { createHobbyProps } from './visitor-hobby-props';
import { bookContact } from './hand-contact';
import type { RiggedCharacter } from './rigged-character';
import type { Character } from './visitor-appearance';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createVisitorProps() {
  const root = new T.Group(),
    phone = new T.Group(),
    cup = new T.Group();
  const hobbies = createHobbyProps();
  root.add(phone, cup, hobbies.root);
  root.visible = false;
  root.name = 'Seated phone and coffee';
  phone.name = 'Phone / screen toward eyes';
  cup.name = 'Cup / palm held handle';
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
  const handle = new T.Mesh(new T.TorusGeometry(0.033, 0.007, 8, 24), ceramic);
  handle.position.set(0.07, 0.052, 0);
  cup.add(handle);
  const liquid = new T.Mesh(new T.CircleGeometry(0.046, 24), coffee);
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.077;
  cup.add(liquid);
  let activeKind = 0;
  return {
    root,
    update(
      kind: number,
      amount: number,
      _character: Character | 'resident',
      age = 0,
    ) {
      activeKind = amount > 0.015 ? kind : 0;
      root.visible = activeKind > 0 && activeKind <= 5;
      hobbies.update(kind >= 3 && kind <= 5 ? kind : 0, amount, age);
      phone.visible = activeKind === 1;
      cup.visible = activeKind === 2;
    },
    follow(rig: RiggedCharacter) {
      root.updateWorldMatrix(true, true);
      const left = root.worldToLocal(rig.palm('L'));
      const right = root.worldToLocal(rig.palm('R'));
      const orientation = root
        .getWorldQuaternion(new T.Quaternion())
        .invert()
        .multiply(rig.root.getWorldQuaternion(new T.Quaternion()));
      const up = new T.Vector3(0, 1, 0).applyQuaternion(orientation);
      const forward = new T.Vector3(0, 0, 1).applyQuaternion(orientation);
      const contact = bookContact(left, right, up, forward);
      hobbies.book.position.copy(contact.position);
      hobbies.book.quaternion.copy(contact.quaternion);
      hobbies.book.scale.set(contact.width / 0.37, 1, 0.82);
      if (activeKind === 4) {
        const x = new T.Vector3(1, 0, 0).applyQuaternion(orientation);
        const normal = up
          .clone()
          .multiplyScalar(0.86)
          .addScaledVector(forward, -0.51)
          .normalize();
        hobbies.pad.quaternion.setFromRotationMatrix(
          new T.Matrix4().makeBasis(
            x,
            normal,
            new T.Vector3().crossVectors(x, normal),
          ),
        );
        hobbies.pad.position
          .copy(left)
          .addScaledVector(x, 0.135)
          .addScaledVector(normal, 0.025);
        hobbies.pad.updateMatrixWorld(true);
        const grip = hobbies.pad.worldToLocal(root.localToWorld(right.clone()));
        const tip = new T.Vector3(grip.x - 0.025, 0.032, grip.z - 0.025);
        hobbies.pencil.position.copy(tip);
        hobbies.pencil.quaternion.setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          grip.sub(tip).normalize(),
        );
      }
      // The handle surrounds the palm; the cup body stays outside the fingers.
      cup.quaternion
        .copy(orientation)
        .multiply(
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI),
        );
      cup.position
        .copy(left)
        .sub(new T.Vector3(0.07, 0.052, 0).applyQuaternion(cup.quaternion));
      hobbies.flowers.quaternion.copy(orientation);
      hobbies.flowers.position.copy(left).addScaledVector(up, -0.025);
      phone.quaternion
        .copy(orientation)
        .multiply(
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI),
        );
      phone.position
        .copy(left)
        .add(right)
        .multiplyScalar(0.5)
        .addScaledVector(forward, 0.025);
      root.updateMatrixWorld(true);
    },
    dispose() {
      hobbies.dispose();
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      [dark, screen, ceramic, coffee].forEach((m) => m.dispose());
    },
  };
}
