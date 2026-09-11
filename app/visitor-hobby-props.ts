import * as T from 'three';
export function createHobbyProps() {
  const root = new T.Group(),
    book = new T.Group(),
    pad = new T.Group(),
    flowers = new T.Group(),
    tea = new T.Group();
  root.add(book, pad, flowers, tea);
  const materials: T.Material[] = [];
  const mat = (color: string) => {
    const m = new T.MeshStandardMaterial({
      color,
      roughness: 0.8,
      side: T.DoubleSide,
    });
    materials.push(m);
    return m;
  };
  const cover = mat('#657d70'),
    paper = mat('#e6dbc1'),
    ink = mat('#737665'),
    pink = mat('#b984a0'),
    yellow = mat('#d1ad56'),
    leaf = mat('#7d9465'),
    wood = mat('#b58a59'),
    white = mat('#e9dcc0');
  const mesh = (
    p: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new T.Mesh(g, m);
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
  ) => mesh(p, new T.BoxGeometry(w, h, d), m, x, y, z);
  box(book, 0.37, 0.018, 0.25, 0, 0, 0, cover);
  for (const x of [-0.094, 0.094]) {
    box(book, 0.174, 0.02, 0.23, x, 0.018, 0, paper);
    for (let j = 0; j < 7; j++)
      box(
        book,
        0.13 - (j % 3) * 0.015,
        0.001,
        0.002,
        x,
        0.0285,
        -0.085 + j * 0.025,
        ink,
      );
  }
  const leafPage = new T.Group();
  leafPage.position.set(0, 0.03, 0);
  book.add(leafPage);
  box(leafPage, 0.174, 0.001, 0.23, 0.091, 0, 0, paper);
  for (let j = 0; j < 6; j++)
    box(leafPage, 0.12, 0.001, 0.002, 0.092, 0.001, -0.08 + j * 0.028, ink);
  box(pad, 0.33, 0.015, 0.27, 0, 0, 0, wood);
  box(pad, 0.3, 0.016, 0.25, 0.008, 0.014, 0, paper);
  for (let i = 0; i < 7; i++) {
    const ring = mesh(
      pad,
      new T.TorusGeometry(0.014, 0.0025, 5, 10),
      ink,
      -0.151,
      0.013,
      -0.105 + i * 0.035,
    );
    ring.rotation.y = Math.PI / 2;
  }
  const sketchLine = (points: number[][]) => {
    const curve = new T.CatmullRomCurve3(
      points.map((v) => new T.Vector3(...v)),
    );
    mesh(pad, new T.TubeGeometry(curve, 16, 0.0014, 4, false), ink);
  };
  sketchLine([
    [0.01, 0.023, 0.1],
    [0.03, 0.023, -0.015],
    [0.06, 0.023, -0.08],
  ]);
  for (let i = 0; i < 4; i++)
    for (const sign of [-1, 1])
      sketchLine([
        [0.018 + i * 0.009, 0.023, 0.06 - i * 0.037],
        [sign * 0.08, 0.023, 0.028 - i * 0.03],
        [0.03 + i * 0.009, 0.023, 0.027 - i * 0.037],
      ]);
  const pencil = new T.Group();
  pad.add(pencil);
  mesh(
    pencil,
    new T.CylinderGeometry(0.004, 0.004, 0.16, 6),
    yellow,
    0,
    0.08,
    0,
  );
  mesh(
    pencil,
    new T.ConeGeometry(0.004, 0.015, 6),
    wood,
    0,
    -0.007,
    0,
  ).rotation.z = Math.PI;
  for (let i = 0; i < 5; i++) {
    const x = Math.sin(i * 2.4) * 0.046,
      z = Math.cos(i * 2.4) * 0.044,
      h = 0.13 + i * 0.012;
    const stem = mesh(
      flowers,
      new T.CylinderGeometry(0.002, 0.002, h, 6),
      leaf,
      x / 2,
      h / 2,
      z / 2,
    );
    stem.rotation.z = -x / h;
    for (let j = 0; j < 6; j++) {
      const petal = mesh(
        flowers,
        new T.SphereGeometry(0.018, 7, 5),
        i % 2 ? pink : white,
        x + Math.sin((j * Math.PI) / 3) * 0.02,
        h,
        z + Math.cos((j * Math.PI) / 3) * 0.02,
      );
      petal.scale.y = 0.35;
    }
    mesh(flowers, new T.SphereGeometry(0.01, 6, 4), yellow, x, h + 0.004, z);
  }
  const wrap = mesh(
    flowers,
    new T.ConeGeometry(0.044, 0.1, 7, 1, true),
    paper,
    0,
    0.018,
    0,
  );
  wrap.rotation.z = Math.PI;
  mesh(
    tea,
    new T.CylinderGeometry(0.056, 0.044, 0.085, 18, 1, true),
    white,
    0,
    0.045,
    0,
  );
  mesh(
    tea,
    new T.CylinderGeometry(0.052, 0.052, 0.002, 18),
    yellow,
    0,
    0.075,
    0,
  );
  mesh(tea, new T.TorusGeometry(0.027, 0.006, 6, 16), white, 0.068, 0.05, 0);
  book.name = 'Open book on lap';
  pad.name = 'Sketchpad and moving pencil';
  flowers.name = 'Small bouquet';
  tea.name = 'Gift tea';
  return {
    root,
    book,
    pad,
    flowers,
    tea,
    update(kind: number, amount: number, age: number) {
      book.visible = kind === 3 && amount > 0.01;
      pad.visible = kind === 4 && amount > 0.01;
      flowers.visible = kind === 5 && amount > 0.01;
      tea.visible = kind === 2 && amount > 0.01;
      root.scale.setScalar(amount);
      const cycle = age % 5.5,
        turn = cycle > 3.7 ? Math.min(1, (cycle - 3.7) / 1.25) : 0;
      leafPage.visible = kind === 3 && turn > 0 && turn < 1;
      leafPage.rotation.z = turn * Math.PI;
      pencil.position.set(
        0.028 + Math.sin(age * 2.5) * 0.031,
        0.032,
        0.011 + Math.cos(age * 1.6) * 0.052,
      );
      pencil.rotation.set(0.25, 0, -0.4);
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
    },
  };
}
