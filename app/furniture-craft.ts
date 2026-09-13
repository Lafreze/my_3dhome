import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoomId } from './house-data';
import type { ObjectId } from './room-data';
import type { SeatAnchors } from './seat-scene';

/** Room-specific construction, fitted to the existing furniture and seat anchors. */
export function addFurnitureCraft(k: {
  roots: Record<RoomId, T.Group>;
  groups: Map<ObjectId, T.Group>;
  seats: SeatAnchors;
  materials: T.Material[];
  textures: T.Texture[];
  oak: T.MeshStandardMaterial;
  paleWood: T.MeshStandardMaterial;
  darkWood: T.MeshStandardMaterial;
  brass: T.MeshStandardMaterial;
}) {
  const mat = (color: string, roughness = 0.7) => {
    const m = new T.MeshStandardMaterial({ color, roughness });
    k.materials.push(m);
    return m;
  };
  const dark = mat('#544334'),
    ink = mat('#393e36'),
    linen = mat('#c8bda5'),
    leather = mat('#64715a', 0.78),
    wood = k.oak,
    pale = k.paleWood,
    brass = k.brass;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#b89d73';
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#745b3936';
  c.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    c.beginPath();
    c.ellipse(-28, 180, 43 + i * 8, 30 + i * 6, -0.2, 0, Math.PI * 2);
    c.stroke();
  }
  const endTexture = new T.CanvasTexture(cv);
  endTexture.colorSpace = T.SRGBColorSpace;
  k.textures.push(endTexture);
  const endgrain = mat('#e6d8bd');
  endgrain.map = endTexture;
  const mesh = (
    p: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const box = (
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) =>
    mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.016, w / 3, h / 3, d / 3)),
      m,
      x,
      y,
      z,
    );
  const cyl = (
    p: T.Object3D,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => mesh(p, new T.CylinderGeometry(r, r, h, 16), m, x, y, z);
  const tube = (p: T.Object3D, points: number[][], r: number, m: T.Material) =>
    mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
        24,
        r,
        6,
        false,
      ),
      m,
    );
  const parts: T.Group[] = [];
  const part = (p: T.Object3D | undefined | null, name: string) => {
    if (!p) throw Error(`Missing furniture: ${name}`);
    const g = new T.Group();
    g.name = name;
    g.userData.furnitureCraft = name;
    p.add(g);
    parts.push(g);
    return g;
  };
  const seat = (id: string) => k.seats.get(id)?.parent;
  const plug = (p: T.Object3D, x: number, y: number, z: number, r = 0.012) => {
    const o = cyl(p, r, 0.007, x, y, z, endgrain);
    o.rotation.x = Math.PI / 2;
  };

  // Study: a cabinetmaker's desk, with a shadow groove, dovetail drawer and cable fittings.
  const desk = part(k.groups.get('desk'), 'Study / fitted desk joinery');
  for (const z of [-0.532, 0.532])
    box(desk, 2.61, 0.017, 0.019, 0, 1.191, z, dark);
  for (const x of [-1.376, 1.376]) {
    const cap = mesh(
      desk,
      new T.PlaneGeometry(1.02, 0.062),
      endgrain,
      x,
      1.227,
      0,
    );
    cap.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const z of [-0.32, 0.32]) plug(desk, x * 0.89, 1.096, z);
  }
  // A scalloped cable tray is underneath the back rail, outside knees and drawer travel.
  box(desk, 1.18, 0.034, 0.19, -0.29, 1.026, -0.35, dark);
  for (let i = 0; i < 9; i++)
    box(desk, 0.036, 0.055, 0.025, -0.82 + i * 0.13, 1.065, -0.43, pale);
  for (const x of [-1.0, -0.87]) {
    const tie = mesh(
      desk,
      new T.TorusGeometry(0.024, 0.005, 6, 16),
      brass,
      x,
      1.274,
      -0.44,
    );
    tie.rotation.x = -Math.PI / 2;
  }
  const drawer = part(k.groups.get('drawer'), 'Study / dovetailed drawer face');
  for (const x of [-0.233, 0.233])
    for (let i = 0; i < 3; i++) {
      const tooth = box(
        drawer,
        0.021,
        0.024,
        0.007,
        x,
        -0.05 + i * 0.046,
        0.407,
        i % 2 ? wood : dark,
      );
      tooth.rotation.z = x > 0 ? 0.18 : -0.18;
    }
  for (const y of [-0.067, 0.067])
    box(drawer, 0.41, 0.009, 0.008, 0, y, 0.407, dark);
  box(drawer, 0.225, 0.058, 0.008, 0, 0, 0.409, wood);

  const work = part(seat('study-work'), 'Study / laminated curved chair');
  for (const y of [1.311, 1.322])
    tube(
      work,
      [
        [-0.39, y, 0.32],
        [-0.2, y, 0.425],
        [0, y, 0.47],
        [0.2, y, 0.425],
        [0.39, y, 0.32],
      ],
      0.0045,
      dark,
    );
  for (const x of [-0.285, 0.285]) {
    plug(work, x, 1.12, 0.397, 0.017);
    box(work, 0.019, 0.25, 0.016, x, 0.47, -0.285, dark);
  }
  for (const x of [-0.23, 0.23])
    box(work, 0.19, 0.014, 0.51, x, 0.568, 0, linen);
  const lounge = part(
    seat('study-reading'),
    'Study / leather lounge construction',
  );
  for (const x of [-0.3, -0.1, 0.1, 0.3])
    box(lounge, 0.105, 0.014, 0.72, x, 0.493, 0, linen);
  for (const x of [-0.46, 0.46])
    for (const z of [-0.3, 0.3]) plug(lounge, x, 0.85, z, 0.017);
  for (const x of [-0.47, 0.47])
    tube(
      lounge,
      [
        [x, 0.72, -0.36],
        [x, 1.05, -0.43],
        [x, 1.31, -0.45],
      ],
      0.008,
      dark,
    );
  const shelf = part(
    k.groups.get('shelf'),
    'Study / shelf edge and pegged joints',
  );
  for (const y of [0.29, 1.027, 1.857, 2.917])
    box(shelf, 2.17, 0.018, 0.017, 0, y, 0.311, dark);
  for (const x of [-1.12, 1.12])
    for (const y of [0.34, 1.06, 1.9, 2.79]) plug(shelf, x, y, 0.321);

  // Living room: low solid-wood coffee table, with exposed stretchers and recessed joinery.
  const living = part(k.roots.living, 'Living / low table frame');
  living.position.set(0.55, 0, -1.05);
  for (const z of [-0.34, 0.34])
    box(living, 1.39, 0.12, 0.035, 0, 0.526, z, wood);
  for (const x of [-0.69, 0.69]) {
    box(living, 0.045, 0.12, 0.53, x, 0.526, 0, wood);
    for (const z of [-0.268, 0.268]) plug(living, x, 0.51, z, 0.017);
  }
  for (const z of [-0.276, 0.276])
    box(living, 1.3, 0.03, 0.023, 0, 0.305, z, pale);
  // Fine seams along the rear frame belong to the sofa, not a fabric drape across its seat.
  const sofa = part(
    seat('living-sofa-1'),
    'Living / sofa timber upholstery frame',
  );
  for (let i = 0; i < 12; i++)
    plug(sofa, -1.53 + i * 0.278, 0.45, -0.69, 0.006);

  // Bedroom: recessed bedside drawer panels with small half-round pulls.
  for (const x of [-2.55, 1.54]) {
    const night = part(k.roots.bedroom, 'Bedroom / bedside cabinet moulding');
    night.position.set(x, 0, -1.94);
    for (const y of [0.37, 0.56]) {
      for (const dx of [-0.265, 0.265])
        box(night, 0.014, 0.125, 0.009, dx, y, 0.379, pale);
      for (const dy of [-0.063, 0.063])
        box(night, 0.54, 0.014, 0.009, 0, y + dy, 0.379, pale);
      const pull = mesh(
        night,
        new T.TorusGeometry(0.043, 0.009, 6, 20, Math.PI),
        brass,
        0,
        y,
        0.405,
      );
      pull.rotation.z = Math.PI;
    }
  }
  const bench = part(
    seat('bedroom-bench-1'),
    'Bedroom / upholstered bench welt',
  );
  for (const z of [-0.267, 0.267])
    tube(
      bench,
      [
        [-1, 0.578, z],
        [0, 0.578, z],
        [1, 0.578, z],
      ],
      0.006,
      linen,
    );

  // Gallery: a pale ash bench with visible end-grain finger joints.
  const gallery = part(
    seat('gallery-bench-1'),
    'Gallery / ash bench finger joints',
  );
  for (const x of [-0.99, 0.99]) {
    box(gallery, 0.073, 0.31, 0.45, x, 0.28, 0, pale);
    for (let j = 0; j < 5; j++)
      box(gallery, 0.076, 0.028, 0.034, x, 0.43, -0.19 + j * 0.092, endgrain);
  }
  box(gallery, 1.96, 0.057, 0.056, 0, 0.25, 0, wood);

  // Cafe chairs retain their curved ladder backs, with brass dowels and apron detailing.
  for (let i = 1; i <= 9; i++) {
    const chair = part(
      seat(`cafe-chair-${i}`),
      'Cafe / chair dowels and apron',
    );
    if (i <= 7) {
      for (const x of [-0.276, 0.276])
        for (const y of [1.28, 1.39]) plug(chair, x, y, 0.34, 0.011);
      for (const z of [-0.283, 0.283])
        box(chair, 0.48, 0.07, 0.024, 0, 0.656, z, wood);
    } else {
      for (const x of [-0.45, 0.45])
        for (let j = 0; j < 7; j++)
          plug(chair, x, 0.905, -0.32 + j * 0.1, 0.006);
      box(chair, 0.74, 0.065, 0.025, 0, 0.485, -0.415, wood);
    }
  }

  // Library: traditional raised drawer panels and an inset writing surface, unlike the study desk.
  const library = part(
    k.groups.get('libraryDesk'),
    'Library / writing desk raised panels',
  );
  for (const x of [-0.82, 0, 0.82]) {
    for (const dx of [-0.32, 0.32])
      box(library, 0.025, 0.16, 0.018, x + dx, 1.01, 0.689, wood);
    for (const y of [0.928, 1.092])
      box(library, 0.665, 0.023, 0.018, x, y, 0.689, wood);
  }
  box(library, 1.6, 0.004, 0.83, 0.08, 1.264, 0.1, leather);
  for (const z of [-0.305, 0.505])
    box(library, 1.54, 0.002, 0.008, 0.08, 1.267, z, brass);
  for (const x of [-0.695, 0.855])
    box(library, 0.008, 0.002, 0.8, x, 1.267, 0.1, brass);
  const libraryChair = part(
    seat('library-desk'),
    'Library / carved chair crest',
  );
  tube(
    libraryChair,
    [
      [-0.31, 1.55, -0.32],
      [-0.18, 1.59, -0.32],
      [0, 1.62, -0.32],
      [0.18, 1.59, -0.32],
      [0.31, 1.55, -0.32],
    ],
    0.015,
    wood,
  );
  for (const x of [-0.31, 0.31]) plug(libraryChair, x, 0.71, -0.357, 0.014);

  // The game table has a pedestal with radial braces and a narrow routed rim.
  const gameTable = part(
    k.groups.get('gameTable'),
    'Gaming / pedestal table bracing',
  );
  const gameRim = mesh(
    gameTable,
    new T.TorusGeometry(0.797, 0.005, 6, 48),
    dark,
    0,
    0.938,
    0,
  );
  gameRim.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    tube(
      gameTable,
      [
        [Math.cos(a) * 0.13, 0.66, Math.sin(a) * 0.13],
        [Math.cos(a) * 0.3, 0.79, Math.sin(a) * 0.3],
        [Math.cos(a) * 0.51, 0.855, Math.sin(a) * 0.51],
      ],
      0.023,
      wood,
    );
  }

  // Arcade stools have dark brackets; pub stools use brass upholstery nails and collars.
  for (const id of ['gaming-stool-1', 'gaming-stool-2']) {
    const anchor = seat(id);
    if (!anchor) continue;
    const g = part(anchor, 'Gaming / stool underside brackets');
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.7;
      box(g, 0.06, 0.04, 0.06, Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2, ink);
    }
    const hoop = mesh(
      g,
      new T.TorusGeometry(0.22, 0.011, 6, 28),
      brass,
      0,
      0.3,
      0,
    );
    hoop.rotation.x = -Math.PI / 2;
  }
  for (let i = 1; i <= 4; i++) {
    const g = part(seat(`bar-stool-${i}`), 'Bar / leather seat nailheads');
    for (let j = 0; j < 20; j++) {
      const a = (j * Math.PI) / 10;
      mesh(
        g,
        new T.SphereGeometry(0.01, 7, 5),
        brass,
        Math.cos(a) * 0.289,
        1.125,
        Math.sin(a) * 0.289,
      );
    }
    for (const x of [-0.223, 0.223])
      for (const z of [-0.223, 0.223]) cyl(g, 0.038, 0.065, x, 0.21, z, brass);
  }

  const gardenTable = part(
    k.groups.get('gardenLemonade'),
    'Garden / tripod table stretchers',
  );
  const gardenRim = mesh(
    gardenTable,
    new T.TorusGeometry(0.856, 0.004, 6, 48),
    pale,
    0,
    0.831,
    0,
  );
  gardenRim.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3,
      b = ((i + 1) * Math.PI * 2) / 3,
      r = 0.474;
    tube(
      gardenTable,
      [
        [Math.sin(a) * r, 0.32, Math.cos(a) * r],
        [Math.sin(b) * r, 0.32, Math.cos(b) * r],
      ],
      0.016,
      wood,
    );
  }

  // Conservatory cane bindings use wrapped junctions rather than another timber chair frame.
  for (const id of ['garden-lounge-1', 'garden-lounge-2']) {
    const anchor = seat(id);
    if (!anchor) continue;
    const g = part(anchor, 'Garden / wrapped cane chair joints');
    for (const x of [-0.45, 0.45])
      for (const z of [-0.41, 0.41])
        for (let j = 0; j < 4; j++) {
          const y = 0.29 + j * 0.012,
            taper = 1 - (0.13 * (y - 0.11)) / 0.46;
          const ring = mesh(
            g,
            new T.TorusGeometry(0.034, 0.005, 5, 16),
            linen,
            x * taper,
            y,
            z * taper,
          );
          ring.rotation.x = -Math.PI / 2;
        }
  }

  // Welt and top-stitch sit on cushion edges; seating volumes and aisle clearances stay intact.
  const livingWelt = part(
    seat('living-sofa-1'),
    'Living / hand-sewn cushion edges',
  );
  for (const x of [-1.05, 0, 1.05]) {
    tube(
      livingWelt,
      [
        [x - 0.42, 0.68, -0.43],
        [x - 0.47, 0.68, 0.42],
        [x - 0.41, 0.68, 0.556],
        [x + 0.41, 0.68, 0.556],
        [x + 0.47, 0.68, 0.42],
        [x + 0.42, 0.68, -0.43],
      ],
      0.0055,
      linen,
    );
    for (let j = 0; j < 21; j++)
      box(
        livingWelt,
        0.012,
        0.002,
        0.003,
        x - 0.4 + j * 0.04,
        0.713,
        0.578,
        linen,
      );
  }
  const benchStitch = part(
    seat('bedroom-bench-1'),
    'Bedroom / bench saddle stitching',
  );
  for (const z of [-0.273, 0.273])
    for (let j = 0; j < 49; j++)
      box(benchStitch, 0.016, 0.003, 0.003, -0.96 + j * 0.04, 0.568, z, linen);
  const libraryInset = part(
    k.groups.get('libraryDesk'),
    'Library / stitched leather writing inset',
  );
  for (const z of [-0.296, 0.496])
    for (let j = 0; j < 48; j++)
      box(
        libraryInset,
        0.014,
        0.001,
        0.001,
        -0.67 + j * 0.032,
        1.268,
        z,
        linen,
      );
  for (const x of [-0.68, 0.84])
    for (let j = 0; j < 23; j++)
      box(
        libraryInset,
        0.001,
        0.001,
        0.015,
        x,
        1.268,
        -0.267 + j * 0.032,
        linen,
      );

  // Fixed details share draw calls; animated drawers and seat parents remain independent.
  for (const g of parts) {
    const bins = new Map<T.Material, T.Mesh[]>();
    for (const o of g.children)
      if (o instanceof T.Mesh && !Array.isArray(o.material)) {
        const list = bins.get(o.material) || [];
        list.push(o);
        bins.set(o.material, list);
      }
    for (const [m, list] of bins) {
      if (list.length < 2) continue;
      const copies = list.map((o) => {
        o.updateMatrix();
        return (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
      });
      const geometry = mergeGeometries(copies);
      copies.forEach((c) => c.dispose());
      if (!geometry) continue;
      mesh(g, geometry, m);
      for (const o of list) {
        g.remove(o);
        o.geometry.dispose();
      }
    }
  }
}
