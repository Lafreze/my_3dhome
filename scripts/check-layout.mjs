import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  layout,
  circulation,
  METRES_PER_UNIT as scale,
  workChairTravel,
  drawerTravel,
} from '../app/room-layout.ts';
const v = (x, z) => ({ x, z });
const corners = (s) =>
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => {
    const x = (a * s.width) / 2,
      z = (b * s.depth) / 2;
    return v(
      s.x + x * Math.cos(s.yaw) + z * Math.sin(s.yaw),
      s.z - x * Math.sin(s.yaw) + z * Math.cos(s.yaw),
    );
  });
function overlap(a, b) {
  const ac = corners(a),
    bc = corners(b);
  const axes = [a.yaw, b.yaw].flatMap((r) => [
    v(Math.cos(r), -Math.sin(r)),
    v(Math.sin(r), Math.cos(r)),
  ]);
  return axes.every((axis) => {
    const p = ac.map((c) => c.x * axis.x + c.z * axis.z),
      q = bc.map((c) => c.x * axis.x + c.z * axis.z);
    return (
      Math.min(Math.max(...p), Math.max(...q)) -
        Math.max(Math.min(...p), Math.min(...q)) >
      0.006
    );
  });
}
function distance(point, s) {
  const dx = point[0] - s.x,
    dz = point[1] - s.z;
  const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw),
    z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
  return Math.hypot(
    Math.max(0, Math.abs(x) - s.width / 2),
    Math.max(0, Math.abs(z) - s.depth / 2),
  );
}
const findings = [];
for (const [id, s] of Object.entries(layout)) {
  assert(
    corners(s).every(
      (c) => c.x >= -3.8 && c.x <= 3.8 && c.z >= -3.2 && c.z <= 3.3,
    ),
    `${id} crosses the room boundary`,
  );
}
const entries = Object.entries(layout);
for (let i = 0; i < entries.length; i++)
  for (let j = i + 1; j < entries.length; j++)
    assert(
      !overlap(entries[i][1], entries[j][1]),
      `${entries[i][0]} overlaps ${entries[j][0]}`,
    );
const pulled = { ...layout.stool, z: layout.stool.z + workChairTravel };
const drawer = {
  x: layout.desk.x + 0.9,
  z: layout.desk.z + drawerTravel + 0.04,
  yaw: 0,
  width: 0.55,
  depth: 0.69,
};
for (const [id, s] of entries) {
  if (id !== 'stool')
    assert(!overlap(pulled, s), `pulled work chair hits ${id}`);
  if (id !== 'desk')
    assert(
      !overlap(drawer, id === 'stool' ? pulled : s),
      `open drawer hits ${id}`,
    );
}
const reach = {
  x: layout.shelf.x,
  z: layout.shelf.z + layout.shelf.depth / 2 + 0.48,
  width: layout.shelf.width,
  depth: 0.96,
  yaw: 0,
};
for (const [id, s] of entries)
  if (id !== 'shelf')
    assert(!overlap(reach, s), `shelf access obstructed by ${id}`);
const facing = (seat, target, front) => {
  const direction = [Math.sin(seat.yaw) * front, Math.cos(seat.yaw) * front],
    dx = target.x - seat.x,
    dz = target.z - seat.z;
  return (direction[0] * dx + direction[1] * dz) / Math.hypot(dx, dz);
};
// Work chair should align with the monitor, not with the drawer cabinet at the right.
assert(
  facing(
    layout.stool,
    { x: layout.desk.x - 0.39, z: layout.desk.z - 0.14 },
    -1,
  ) > 0.995,
  'work chair does not face the monitor',
);
assert(
  facing(layout.chair, layout.coffee, 1) > 0.995,
  'lounge chair does not face coffee table',
);
assert(
  facing(layout.bed, layout.coffee, 1) > 0.98,
  'sofa does not face conversation area',
);
const sofaGap =
  layout.coffee.x -
  layout.coffee.width / 2 -
  (layout.bed.x + layout.bed.depth / 2);
assert(
  sofaGap * scale >= 0.35 && sofaGap * scale <= 0.5,
  'coffee table must be reachable from sofa',
);
let minClearance = Infinity,
  limiting = '';
for (let seg = 0; seg < circulation.length - 1; seg++)
  for (let t = 0; t <= 1; t += 0.02) {
    const a = circulation[seg],
      b = circulation[seg + 1],
      point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (const [id, s] of entries) {
      const d = distance(point, s);
      if (d < minClearance) {
        minClearance = d;
        limiting = id;
      }
    }
  }
findings.push(
  { check: 'static furniture collisions', passed: true },
  { check: 'pulled chair + fully open drawer', passed: true },
  { check: 'chair facing monitor, lounge facing coffee table', passed: true },
  { check: 'shelf access depth', cm: 60 },
  { check: 'sofa-to-table clear gap', cm: Math.round(sofaGap * scale * 100) },
  {
    check: 'main route clearance to closest item',
    cm: Math.round(minClearance * scale * 100),
    item: limiting,
  },
);
assert(
  minClearance * scale >= 0.36,
  `main route too close to ${limiting}: ${(minClearance * scale * 100).toFixed(1)} cm from centreline`,
);
await mkdir('output/playwright', { recursive: true });
await writeFile(
  'output/playwright/layout-check.json',
  JSON.stringify(findings, null, 2),
);
const svg = [];
const x = (c) => 90 + (c + 4) * 85,
  z = (c) => 100 + (c + 3.4) * 85;
svg.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="950" height="825" viewBox="0 0 950 825"><rect width="950" height="825" fill="#f7f4eb"/><style>text{font-family:Arial,'PingFang SC',sans-serif;fill:#344638} .small{font-size:12px;fill:#78806e}</style><text x="90" y="45" font-size="24" letter-spacing="3">SATORI / 布局与动线</text><text x="90" y="72" class="small">家具实际占地、使用朝向与活动余量 · 1 场景单位 = 0.625 m</text><rect x="90" y="100" width="680" height="578" fill="#e9e1cc" stroke="#52664d" stroke-width="4"/>`,
);
svg.push(
  `<path d="${circulation.map((p, i) => (i ? 'L' : 'M') + x(p[0]) + ',' + z(p[1])).join(' ')}" stroke="#adc7ae" stroke-width="${(0.72 / scale) * 85}" opacity=".55" fill="none" stroke-linecap="round"/><path d="${circulation.map((p, i) => (i ? 'L' : 'M') + x(p[0]) + ',' + z(p[1])).join(' ')}" stroke="#4d785c" stroke-width="2" stroke-dasharray="7 5" fill="none"/>`,
);
const names = {
  desk: '工作台',
  stool: '工作椅',
  bed: '沙发',
  coffee: '茶几',
  chair: '阅读椅',
  shelf: '藏书柜',
  lamp: '边几 / 灯',
  record: '唱片柜',
  plant: '绿植',
};
for (const [id, s] of entries) {
  svg.push(
    `<polygon points="${corners(s)
      .map((p) => `${x(p.x)},${z(p.z)}`)
      .join(
        ' ',
      )}" fill="${id === 'bed' || id === 'stool' ? '#adba9b' : id === 'chair' ? '#b99575' : '#d1b89a'}" stroke="#6d795f" stroke-width="1.5"/><text x="${x(s.x)}" y="${z(s.z) + 4}" text-anchor="middle" font-size="14">${names[id]}</text>`,
  );
  if (['bed', 'chair', 'stool'].includes(id)) {
    const front = id === 'stool' ? -1 : 1,
      xx = s.x + Math.sin(s.yaw) * front * 0.45,
      zz = s.z + Math.cos(s.yaw) * front * 0.45;
    svg.push(
      `<path d="M${x(s.x)},${z(s.z)} L${x(xx)},${z(zz)}" stroke="#405f48" stroke-width="3"/><circle cx="${x(xx)}" cy="${z(zz)}" r="3" fill="#405f48"/>`,
    );
  }
}
svg.push(
  `<polygon points="${corners(pulled)
    .map((p) => `${x(p.x)},${z(p.z)}`)
    .join(
      ' ',
    )}" fill="none" stroke="#5e7c5d" stroke-width="1.5" stroke-dasharray="5 4"/><polygon points="${corners(
    drawer,
  )
    .map((p) => `${x(p.x)},${z(p.z)}`)
    .join(
      ' ',
    )}" fill="none" stroke="#ad7656" stroke-dasharray="5 4"/><text x="90" y="725" font-size="15">沙发 — 茶几净距 ${Math.round(sofaGap * scale * 100)} cm　·　书柜前取书区 60 cm</text><text x="90" y="754" class="small">虚线：工作椅拉出 / 抽屉全开　　绿色区域：入口至工作区的主要路线</text><text x="90" y="781" class="small">此图用于虚拟场景布局核验，不是建筑施工或无障碍设计认证。</text></svg>`,
);
await writeFile('output/playwright/layout-plan.svg', svg.join(''));
console.log(JSON.stringify(findings, null, 2));
