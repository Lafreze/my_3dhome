import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Group, Matrix4, Quaternion, Vector3 } from 'three';
import {
  humanHeight,
  humanScale,
  sourceHeights,
} from '../app/character-scale.mjs';
import { handProfiles, floatingPhonePose } from '../app/visitor-hand-poses.ts';
import {
  createVisitorJourney,
  sampleVisitorJourney,
} from '../app/visitor-travel.mjs';

function bounds(file) {
  const data = readFileSync(`public/models/${file}.glb`);
  const length = data.readUInt32LE(12);
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + length));
  const box = new Box3();
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    const matrix = parent
      .clone()
      .multiply(
        node.matrix
          ? new Matrix4().fromArray(node.matrix)
          : new Matrix4().compose(
              new Vector3(...(node.translation || [0, 0, 0])),
              new Quaternion(...(node.rotation || [0, 0, 0, 1])),
              new Vector3(...(node.scale || [1, 1, 1])),
            ),
      );
    if (node.mesh !== undefined)
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const a = gltf.accessors[primitive.attributes.POSITION];
        const v = gltf.bufferViews[a.bufferView];
        assert.equal(a.componentType, 5126);
        for (let i = 0; i < a.count; i++) {
          const p =
            28 +
            length +
            (v.byteOffset || 0) +
            (a.byteOffset || 0) +
            i * (v.byteStride || 12);
          box.expandByPoint(
            new Vector3(
              data.readFloatLE(p),
              data.readFloatLE(p + 4),
              data.readFloatLE(p + 8),
            ).applyMatrix4(matrix),
          );
        }
      }
    for (const child of node.children || []) visit(child, matrix);
  }
  gltf.scenes[gltf.scene || 0].nodes.forEach((index) => visit(index));
  return box;
}

const heights = {};
for (const character of Object.keys(sourceHeights)) {
  const box = bounds(
    character === 'resident'
      ? 'resident-hi3d'
      : `studio-visitor-${character}-standing-v5`,
  );
  const height = (box.max.y - box.min.y) * humanScale(character);
  assert(
    Math.abs(height - humanHeight) < 0.0001,
    `${character}: normalized standing height`,
  );
  heights[character] = +height.toFixed(5);
  if (character === 'resident') continue;
  const journey = createVisitorJourney(
    'study-work',
    'cafe-chair-1',
    'sit',
    'sit',
    1000,
  );
  const walk = sampleVisitorJourney(
    journey,
    1000 + (journey.rise + journey.exit + journey.walk / 2) * 1000,
    character,
  );
  assert.equal(walk.phase, 'walk');
  assert(
    Math.abs(walk.position[1] + box.min.y * humanScale(character) - 0.085) <
      0.003,
    `${character}: feet remain on floor after scaling`,
  );
}

let seatsChecked = 0;
for (const character of Object.keys(handProfiles)) {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const actor = new Group(),
      phone = new Group();
    actor.position.set(5.2, 0.828, 17.4);
    actor.rotation.y = yaw;
    actor.scale.setScalar(humanScale(character));
    actor.add(phone);
    const pose = floatingPhonePose(character);
    phone.position.copy(pose.position);
    phone.quaternion.copy(pose.quaternion);
    actor.updateMatrixWorld(true);
    const eye = actor.localToWorld(new Vector3(...handProfiles[character].eye));
    const palm = actor.localToWorld(
      new Vector3(...handProfiles[character].palm),
    );
    const screenNormal = phone.getWorldDirection(new Vector3());
    const toEye = eye.sub(phone.getWorldPosition(new Vector3())).normalize();
    assert(
      screenNormal.dot(toEye) > 0.99999,
      `${character}/${yaw}: screen faces eyes`,
    );
    assert(
      phone.getWorldPosition(new Vector3()).distanceTo(palm) > 0.2,
      `${character}: phone floats clear of the original hand`,
    );
    seatsChecked++;
  }
}
console.log(
  JSON.stringify({
    heights,
    phoneOrientations: seatsChecked,
    propPlacement: 'floating, original hands unchanged',
    walkingFeet: 'on floor',
  }),
);
