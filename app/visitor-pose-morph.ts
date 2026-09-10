import * as T from 'three';
import { prepareMotionGeometry } from './visitor-motion.ts';
import type { VisitorPart } from './visitor-model';

/** Both poses retain the source UVs: transfer the standing surface without splitting the neck or clothes. */
export async function prepareStandingMorph(
  parts: VisitorPart[],
  reverseFox = false,
) {
  if (parts[0]?.character === 'fox' && !reverseFox) {
    // The seated fan was heavily compressed before decimation. Keep the intact standing
    // topology and fold it down, rather than trying to expand its collapsed triangles.
    const seated = parts.filter((p) => p.pose === 'sit'),
      standing = parts.filter((p) => p.pose === 'rest');
    const targets = standing.map((p) => ({
      ...p,
      pose: 'sit' as const,
      geometry: p.geometry.clone(),
    }));
    await prepareStandingMorph(
      [...targets, ...seated.map((p) => ({ ...p, pose: 'rest' as const }))],
      true,
    );
    for (const p of targets) {
      const g = p.geometry,
        original = g.getAttribute('position'),
        normal = g.getAttribute('normal');
      g.setAttribute('position', g.getAttribute('visitorStandPosition'));
      g.setAttribute('normal', g.getAttribute('visitorStandNormal'));
      g.setAttribute('visitorStandPosition', original);
      g.setAttribute('visitorStandNormal', normal);
      prepareMotionGeometry(g, 'fox');
    }
    seated.forEach((p) => p.geometry.dispose());
    for (const p of standing) {
      p.geometry.setAttribute(
        'visitorStandPosition',
        p.geometry.getAttribute('position'),
      );
      p.geometry.setAttribute(
        'visitorStandNormal',
        p.geometry.getAttribute('normal'),
      );
    }
    parts.splice(0, parts.length, ...targets, ...standing);
    return;
  }
  const size = 64;
  type Triangle = {
    p: T.BufferAttribute | T.InterleavedBufferAttribute;
    n: T.BufferAttribute | T.InterleavedBufferAttribute;
    uv: T.BufferAttribute | T.InterleavedBufferAttribute;
    ids: number[];
  };
  const cells = new Map<number, Triangle[]>();
  for (const part of parts.filter((p) => p.pose === 'rest' && !p.eyelid)) {
    const g = part.geometry,
      uv = g.getAttribute('uv'),
      p = g.getAttribute('position'),
      n = g.getAttribute('normal');
    if (!uv) continue;
    for (let i = 0; i < (g.index?.count || p.count); i += 3) {
      const ids = [0, 1, 2].map((j) => (g.index ? g.index.getX(i + j) : i + j));
      const xs = ids.map((v) =>
        Math.max(0, Math.min(size - 1, Math.floor(uv.getX(v) * size))),
      );
      const ys = ids.map((v) =>
        Math.max(0, Math.min(size - 1, Math.floor(uv.getY(v) * size))),
      );
      const tri = { p, n, uv, ids };
      for (let x = Math.min(...xs); x <= Math.max(...xs); x++)
        for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
          const key = x + y * size,
            list = cells.get(key) || [];
          list.push(tri);
          cells.set(key, list);
        }
    }
  }
  let processed = 0;
  const mapped = new Map<string, number[]>();
  const missing: { geometry: T.BufferGeometry; index: number }[] = [];
  const keyFor = (
    p: T.BufferAttribute | T.InterleavedBufferAttribute,
    i: number,
  ) =>
    [p.getX(i), p.getY(i), p.getZ(i)]
      .map((v) => Math.round(v * 10000))
      .join(',');
  for (const part of parts.filter((p) => p.pose === 'sit')) {
    const g = part.geometry,
      p = g.getAttribute('position'),
      n = g.getAttribute('normal'),
      uv = g.getAttribute('uv');
    const positions = new Float32Array(p.count * 3),
      normals = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let found = false;
      if (uv && !part.eyelid) {
        const u = uv.getX(i),
          v = uv.getY(i),
          key =
            Math.max(0, Math.min(size - 1, Math.floor(u * size))) +
            size * Math.max(0, Math.min(size - 1, Math.floor(v * size)));
        for (const tri of cells.get(key) || []) {
          const [a, b, c] = tri.ids,
            ax = tri.uv.getX(a),
            ay = tri.uv.getY(a),
            bx = tri.uv.getX(b),
            by = tri.uv.getY(b),
            cx = tri.uv.getX(c),
            cy = tri.uv.getY(c);
          const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
          if (Math.abs(det) < 1e-12) continue;
          const wa = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / det,
            wb = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / det,
            wc = 1 - wa - wb;
          if (Math.min(wa, wb, wc) < -0.0005) continue;
          const weights = [wa, wb, wc];
          for (let j = 0; j < 3; j++) {
            const read = (attr: typeof p, id: number) =>
              j === 0 ? attr.getX(id) : j === 1 ? attr.getY(id) : attr.getZ(id);
            positions[i * 3 + j] = tri.ids.reduce(
              (sum, id, k) => sum + read(tri.p, id) * weights[k],
              0,
            );
            normals[i * 3 + j] = tri.ids.reduce(
              (sum, id, k) => sum + read(tri.n, id) * weights[k],
              0,
            );
          }
          found = true;
          break;
        }
      }
      if (found)
        mapped.set(keyFor(p, i), Array.from(positions.slice(i * 3, i * 3 + 3)));
      else missing.push({ geometry: g, index: i });
      if (!found) {
        positions.set([p.getX(i), p.getY(i), p.getZ(i)], i * 3);
        normals.set([n.getX(i), n.getY(i), n.getZ(i)], i * 3);
      }
      if (++processed % 8000 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    g.setAttribute('visitorStandPosition', new T.BufferAttribute(positions, 3));
    g.setAttribute('visitorStandNormal', new T.BufferAttribute(normals, 3));
  }
  const buckets = new Map<string, { p: number[]; delta: number[] }[]>();
  for (const part of parts.filter((p) => p.pose === 'sit' && !p.eyelid)) {
    const p = part.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const match = mapped.get(keyFor(p, i));
      if (!match) continue;
      const original = [p.getX(i), p.getY(i), p.getZ(i)],
        key = original.map((v) => Math.floor(v / 0.025)).join(',');
      const list = buckets.get(key) || [];
      list.push({ p: original, delta: match.map((v, j) => v - original[j]) });
      buckets.set(key, list);
    }
  }
  for (const { geometry: g, index: i } of missing) {
    const p = g.getAttribute('position'),
      out = g.getAttribute('visitorStandPosition'),
      original = [p.getX(i), p.getY(i), p.getZ(i)];
    const exact = mapped.get(keyFor(p, i));
    if (exact) {
      out.setXYZ(i, exact[0], exact[1], exact[2]);
      continue;
    }
    const cell = original.map((v) => Math.floor(v / 0.025)),
      near: { d: number; delta: number[] }[] = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const n of buckets.get(
            [cell[0] + x, cell[1] + y, cell[2] + z].join(','),
          ) || []) {
            const d = Math.hypot(...n.p.map((v, j) => v - original[j]));
            near.push({ d, delta: n.delta });
          }
    near.sort((a, b) => a.d - b.d);
    const selected = near.slice(0, 5);
    let weight = 0;
    const delta = [0, 0, 0];
    for (const n of selected) {
      const w = 1 / Math.max(1e-7, n.d * n.d);
      weight += w;
      for (let j = 0; j < 3; j++) delta[j] += n.delta[j] * w;
    }
    if (weight)
      out.setXYZ(
        i,
        ...(original.map((v, j) => v + delta[j] / weight) as [
          number,
          number,
          number,
        ]),
      );
  }
  // A few decimated UV-border vertices need a smooth displacement field, not a fallback spike.
  for (const part of parts.filter((p) => p.pose === 'sit' && !p.eyelid)) {
    const g = part.geometry,
      p = g.getAttribute('position'),
      out = g.getAttribute('visitorStandPosition');
    const neighbors = Array.from({ length: p.count }, () => new Set<number>());
    const ix = g.index;
    for (let i = 0; i < (ix?.count || p.count); i += 3)
      for (let k = 0; k < 3; k++) {
        const a = ix ? ix.getX(i + k) : i + k,
          b = ix ? ix.getX(i + ((k + 1) % 3)) : i + ((k + 1) % 3);
        neighbors[a].add(b);
        neighbors[b].add(a);
      }
    const delta = (i: number) => [
      out.getX(i) - p.getX(i),
      out.getY(i) - p.getY(i),
      out.getZ(i) - p.getZ(i),
    ];
    for (let pass = 0; pass < 12; pass++) {
      const bad = new Set<number>();
      for (let i = 0; i < p.count; i++)
        for (const j of neighbors[i]) {
          const before = Math.hypot(
            p.getX(i) - p.getX(j),
            p.getY(i) - p.getY(j),
            p.getZ(i) - p.getZ(j),
          );
          const after = Math.hypot(
            out.getX(i) - out.getX(j),
            out.getY(i) - out.getY(j),
            out.getZ(i) - out.getZ(j),
          );
          if (after > Math.max(0.045, before * 3)) {
            bad.add(i);
            bad.add(j);
          }
        }
      if (!bad.size) break;
      const updates = new Map<number, number[]>();
      for (const i of bad) {
        const ids = new Set(neighbors[i]);
        for (const j of neighbors[i]) for (const k of neighbors[j]) ids.add(k);
        const values = [...ids].map(delta),
          median = [0, 1, 2].map(
            (k) =>
              values.map((v) => v[k]).sort((a, b) => a - b)[
                Math.floor(values.length / 2)
              ] || 0,
          );
        updates.set(i, median);
      }
      for (const [i, d] of updates)
        out.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
    const standing = g.clone();
    standing.setAttribute('position', out);
    standing.computeVertexNormals();
    g.setAttribute('visitorStandNormal', standing.getAttribute('normal'));
    standing.dispose();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  for (const part of parts.filter((p) => p.pose === 'rest')) {
    part.geometry.setAttribute(
      'visitorStandPosition',
      part.geometry.getAttribute('position'),
    );
    part.geometry.setAttribute(
      'visitorStandNormal',
      part.geometry.getAttribute('normal'),
    );
  }
}
