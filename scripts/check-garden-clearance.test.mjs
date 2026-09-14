import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {
  edgeDrapeGeometry,
  gardenBasinGeometry,
} from '../app/garden-joinery.ts';
import { gardenDetails as d } from '../app/garden-detail-layout.ts';

test('one-edge cloth stays on its support and drops outside the furniture, above the lower shelf', () => {
  for (const [width, run, drop] of [
    [d.workcloth.width, d.workcloth.run, d.workcloth.drop],
    [0.38, 0.055, 0.26],
    [0.38, 0.13, 0.28],
  ]) {
    const g = edgeDrapeGeometry(width, run, drop),
      p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      assert(
        Math.abs(p.getX(i)) <= width / 2 + 1e-6,
        'cloth must not grow side skirts',
      );
      if (p.getZ(i) < 0)
        assert(p.getY(i) >= 0, 'top must not cut into the support');
      if (p.getY(i) < -0.005)
        assert(p.getZ(i) > 0, 'hanging cloth must clear the edge');
    }
    for (const name of ['normal', 'uv'])
      assert([...g.getAttribute(name).array].every(Number.isFinite));
    g.dispose();
  }
  const work = edgeDrapeGeometry(
    d.workcloth.width,
    d.workcloth.run,
    d.workcloth.drop,
  );
  assert(
    work.boundingBox.min.y + d.workcloth.y > 0.7,
    'hem must clear shelf and stored pots',
  );
  assert(d.workcloth.z > 1.34 / 2, 'hang starts outside the actual table edge');
  work.dispose();
});

test('reading table prop areas remain separated and wholly supported by its circular top', () => {
  const rect = (x, z, w, h, a = 0) => {
    const pts = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        pts.push([
          x + ((sx * w) / 2) * Math.cos(a) + ((sz * h) / 2) * Math.sin(a),
          z - ((sx * w) / 2) * Math.sin(a) + ((sz * h) / 2) * Math.cos(a),
        ]);
    return pts;
  };
  const r = d.reading;
  const areas = [
    rect(
      r.album.x,
      r.album.z,
      0.87 * r.album.scale,
      0.62 * r.album.scale,
      r.album.yaw,
    ),
    rect(r.guide.x, r.guide.z, r.guide.width, r.guide.depth, r.guide.yaw),
    rect(r.cup.x, r.cup.z, r.cup.radius * 2, r.cup.radius * 2),
    rect(r.plate.x, r.plate.z, r.plate.radius * 2, r.plate.radius * 2),
  ];
  for (const points of areas)
    for (const [x, z] of points) assert(Math.hypot(x, z) < r.radius - 0.015);
  const bounds = areas.map((p) => ({
    minX: Math.min(...p.map((x) => x[0])),
    maxX: Math.max(...p.map((x) => x[0])),
    minZ: Math.min(...p.map((x) => x[1])),
    maxZ: Math.max(...p.map((x) => x[1])),
  }));
  for (let i = 0; i < bounds.length; i++)
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i],
        b = bounds[j];
      assert(
        a.maxX + 0.012 < b.minX ||
          b.maxX + 0.012 < a.minX ||
          a.maxZ + 0.012 < b.minZ ||
          b.maxZ + 0.012 < a.minZ,
        `props ${i} and ${j} overlap`,
      );
    }
  const mag = r.magnifier;
  assert(Math.hypot(mag.x, mag.z) + 0.085 < r.radius);
  assert(
    Math.hypot(
      mag.x + Math.sin(mag.yaw) * 0.2,
      mag.z + Math.cos(mag.yaw) * 0.2,
    ) +
      0.012 <
      r.radius,
  );
});

test('picnic lid opens behind the rim and stays clear of the independently mounted handle', () => {
  const lid = new T.Mesh(new T.BoxGeometry(1.15, 0.025, 0.7));
  lid.geometry.translate(0, 0, 0.35);
  lid.position.set(0, 0.578, d.picnic.hingeZ);
  lid.rotation.x = d.picnic.angle;
  lid.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(lid);
  assert(b.max.z < -0.37, 'lid must stay behind the rear rim');
  assert(b.min.y > 0.56, 'lid must not cut into the basket');
  assert(
    0.09 - 0.025 - b.max.z > 0.4,
    'carrying handle must have independent clearance',
  );
  lid.geometry.dispose();
  lid.material.dispose();
});

test('water bowl has an open well, a closed bottom and space for its water surface', () => {
  const g = gardenBasinGeometry(),
    m = new T.MeshBasicMaterial({ side: T.DoubleSide }),
    bowl = new T.Mesh(g, m);
  bowl.updateMatrixWorld(true);
  const ray = new T.Raycaster(
    new T.Vector3(0, 1.5, 0),
    new T.Vector3(0, -1, 0),
  );
  const hits = ray.intersectObject(bowl);
  assert(hits.length > 0);
  assert(
    Math.abs(hits[0].point.y - 0.555) < 1e-5,
    'the centre must be hollow down to its ceramic floor',
  );
  assert(hits[0].point.y < d.basin.waterY - 0.15);
  g.computeBoundingBox();
  assert(g.boundingBox.max.x <= d.basin.radius + 1e-5);
  for (const n of ['position', 'normal', 'uv'])
    assert([...g.getAttribute(n).array].every(Number.isFinite));
  g.dispose();
  m.dispose();
});
