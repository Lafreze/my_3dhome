/** UV duplicates at the same point must move together when the skeleton bends. */
export function unifySkinSeams(primitives) {
  const groups = new Map();
  for (const p of primitives) {
    const a = p.getAttribute('POSITION'),
      j = p.getAttribute('JOINTS_0'),
      w = p.getAttribute('WEIGHTS_0');
    if (!j || !w) continue;
    for (let i = 0; i < a.getCount(); i++) {
      const key = a
        .getElement(i, [])
        .map((v) => Math.round(v * 1e5))
        .join(',');
      const group = groups.get(key) || [];
      group.push({ j, w, i });
      groups.set(key, group);
    }
  }
  let repaired = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const totals = new Map();
    for (const { j, w, i } of group)
      j.getElement(i, []).forEach((bone, k) =>
        totals.set(bone, (totals.get(bone) || 0) + w.getElement(i, [])[k]),
      );
    const entries = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 4),
      sum = entries.reduce((n, e) => n + e[1], 0);
    const joints = Array(4).fill(0),
      weights = Array(4).fill(0);
    entries.forEach(([bone, weight], k) => {
      joints[k] = bone;
      weights[k] = weight / sum;
    });
    for (const { j, w, i } of group) {
      j.setElement(i, joints);
      w.setElement(i, weights);
    }
    repaired++;
  }
  return repaired;
}
