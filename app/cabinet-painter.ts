import {
  bumpers,
  flipperSegment,
  raceGate,
  reversiMoves,
  type CabinetGame,
  type Input,
} from './cabinet-engine';
const colors = ['#e9b373', '#89c6b3', '#caa5df', '#ee9890'];
export function paintCabinet(
  c: CanvasRenderingContext2D,
  g: CabinetGame,
  input: Input,
) {
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    r = 0,
  ) => {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
  };
  const circle = (x: number, y: number, r: number, color: string) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  const text = (
    s: string,
    x: number,
    y: number,
    size = 16,
    color = '#f3ebd6',
    align: CanvasTextAlign = 'left',
  ) => {
    c.font = `${size >= 24 ? '600 ' : ''}${size}px ui-monospace, monospace`;
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  const line = (points: number[][], color: string, width = 2) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    points.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  const star = (x: number, y: number, r: number, color: string) => {
    c.fillStyle = color;
    c.beginPath();
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5 - Math.PI / 2,
        rr = j % 2 ? r * 0.44 : r;
      if (j) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else c.moveTo(x, y - r);
    }
    c.closePath();
    c.fill();
  };
  const backdrop = (a: string, b: string) => {
    const grad = c.createLinearGradient(0, 0, 0, 480);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    rect(0, 0, 720, 480, grad as unknown as string);
  };
  const car = (x: number, y: number, angle: number, color: string) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle + Math.PI / 2);
    rect(-14, -23, 30, 49, '#172b3150', 7);
    for (const s of [-1, 1]) {
      rect(s * 13 - 3, -14, 6, 10, '#1c3031', 2);
      rect(s * 13 - 3, 10, 6, 10, '#1c3031', 2);
    }
    rect(-11, -22, 22, 44, color, 5);
    rect(-8, -11, 16, 12, '#264952', 3);
    rect(-8, 7, 16, 9, '#365663', 2);
    rect(-9, -20, 5, 3, '#fff2bd');
    rect(4, -20, 5, 3, '#fff2bd');
    line(
      [
        [0, -20],
        [0, -14],
      ],
      '#f5dec0',
      3,
    );
    c.restore();
  };
  c.clearRect(0, 0, 720, 480);
  switch (g.id) {
    case 'pinball': {
      backdrop('#172d3a', '#30535a');
      for (let j = 0; j < 48; j++)
        circle(
          (j * 173 + 51) % 720,
          (j * 83 + 27) % 480,
          j % 4 === 0 ? 1.5 : 0.7,
          '#b5d4cd55',
        );
      text('ORBIT', 102, 145, 28, '#ead5a0', 'center');
      text('PINBALL', 102, 172, 14, '#90b8b5', 'center');
      circle(102, 238, 42, '#244651');
      c.strokeStyle = '#c6ab72';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(102, 238, 57, 17, -0.4, 0, Math.PI * 2);
      c.stroke();
      circle(86, 225, 5, '#95b9b3');
      rect(205, 23, 310, 445, '#0d202b', 24);
      rect(213, 31, 294, 429, '#bea977', 20);
      rect(219, 37, 282, 419, '#173c48', 18);
      for (let j = 0; j < 8; j++)
        line(
          [
            [226, 72 + j * 45],
            [494, 72 + j * 45],
          ],
          '#315665',
          1,
        );
      for (let j = 0; j < 6; j++)
        line(
          [
            [242 + j * 46, 43],
            [242 + j * 46, 443],
          ],
          '#294c5d',
          1,
        );
      line(
        [
          [485, 416],
          [485, 93],
          [460, 55],
          [415, 47],
        ],
        '#819d9b',
        3,
      );
      for (const [j, b] of bumpers.entries()) {
        circle(b.x, b.y, b.r + 7, '#0f2f3c');
        circle(b.x, b.y, b.r + 3, g.glow[j] > 0 ? '#fff4bb' : '#b9a574');
        circle(b.x, b.y, b.r, g.glow[j] > 0 ? '#ffe3a4' : '#466d70');
        circle(b.x - 5, b.y - 7, b.r * 0.63, '#7fa3a0');
        star(b.x, b.y, b.r * 0.52, '#f2dbab');
      }
      line(
        [
          [224, 300],
          [277, 388],
        ],
        '#91b4ab',
        8,
      );
      line(
        [
          [496, 300],
          [443, 388],
        ],
        '#91b4ab',
        8,
      );
      for (const left of [true, false]) {
        const [a, b, d, e] = flipperSegment(
          left,
          input.held.has(left ? 'left' : 'right'),
        );
        line(
          [
            [a, b],
            [d, e],
          ],
          '#0b222e',
          17,
        );
        line(
          [
            [a, b - 2],
            [d, e - 2],
          ],
          left ? '#e4b86c' : '#d08068',
          11,
        );
        circle(a, b, 5, '#f2dfb3');
      }
      text('✦', 360, 313, 46, '#45646c', 'center');
      text('SATORI', 360, 342, 12, '#78979a', 'center');
      const ball = c.createRadialGradient(g.x - 2, g.y - 3, 1, g.x, g.y, 8);
      ball.addColorStop(0, '#fff');
      ball.addColorStop(0.4, '#dde9e6');
      ball.addColorStop(1, '#4a777c');
      circle(g.x + 2, g.y + 3, 8, '#0005');
      circle(g.x, g.y, 7, ball as unknown as string);
      text('SCORE', 615, 142, 13, '#8eb3b4', 'center');
      text(String(g.score).padStart(5, '0'), 615, 180, 29, '#edd8a3', 'center');
      text('BALLS', 615, 255, 13, '#8eb3b4', 'center');
      for (let j = 0; j < g.balls; j++) circle(590 + j * 24, 280, 7, '#dbe1c9');
      text('5,000', 615, 355, 18, '#b5c7b9', 'center');
      text('TARGET', 615, 378, 11, '#87a7ab', 'center');
      break;
    }
    case 'racing': {
      backdrop('#91bbb2', '#779b80');
      rect(0, 0, 720, 480, '#c9d3a3');
      c.fillStyle = '#6dadae';
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(90, 120, 12, 220, 53, 480);
      c.lineTo(0, 480);
      c.closePath();
      c.fill();
      for (let j = 0; j < 26; j++) {
        const x = (j * 117 + 27) % 720,
          y = (j * 89 + 50) % 480;
        const r = Math.hypot((x - 360) / 255, (y - 240) / 145);
        if (Math.abs(r - 1) < 0.4) continue;
        circle(x + 3, y + 4, 14, '#315b5940');
        circle(x, y, 15, '#72906b');
        circle(x - 4, y - 3, 9, '#94ab7c');
      }
      c.beginPath();
      c.ellipse(360, 240, 255, 145, 0, 0, Math.PI * 2);
      c.lineWidth = 79;
      c.strokeStyle = '#ede0bb';
      c.stroke();
      c.lineWidth = 69;
      c.strokeStyle = '#4c6060';
      c.stroke();
      c.setLineDash([13, 14]);
      c.lineWidth = 2;
      c.strokeStyle = '#bbc8af';
      c.stroke();
      c.setLineDash([]);
      rect(276, 205, 168, 64, '#a8bf8b', 9);
      text('COAST', 360, 233, 23, '#4e7460', 'center');
      text('SUNDAY RALLY', 360, 254, 11, '#537b65', 'center');
      for (let j = 0; j < 8; j++)
        for (let k = 0; k < 2; k++)
          rect(
            353 + k * 7,
            350 + j * 8,
            7,
            8,
            (j + k) % 2 ? '#3d504f' : '#f6e9c9',
          );
      const gate = raceGate(g.checkpoint);
      circle(gate[0], gate[1], 26, '#edcd8060');
      circle(gate[0], gate[1], 6, '#f8e8b0');
      if (g.trail.length > 1) line(g.trail, '#24393725', 3);
      const ghostAngle = Math.PI / 2 + (g.time * Math.PI * 2) / 26;
      c.save();
      c.globalAlpha = 0.4;
      car(
        360 + 255 * Math.cos(ghostAngle),
        240 + 145 * Math.sin(ghostAngle),
        Math.atan2(145 * Math.cos(ghostAngle), -255 * Math.sin(ghostAngle)),
        '#d1e2db',
      );
      c.restore();
      car(g.x, g.y, g.angle, '#e4a473');
      rect(20, 16, 175, 42, '#284747e8', 10);
      text(`LAP ${Math.min(3, g.lap + 1)} / 3`, 35, 43, 18);
      rect(535, 16, 165, 42, '#284747e8', 10);
      text(
        `${Math.max(0, 90 - g.time).toFixed(1)} s`,
        682,
        43,
        20,
        '#f2e6c9',
        'right',
      );
      rect(265, 436, 190, 26, '#294948', 13);
      rect(270, 441, g.fuel * 1.8, 16, '#dcc18a', 8);
      text('BOOST', 360, 454, 10, '#344e4c', 'center');
      text(`${Math.round(g.speed)} km/h`, 688, 456, 13, '#2b4c42', 'right');
      break;
    }
    case 'shooter': {
      backdrop('#141a39', '#343b61');
      for (let j = 0; j < 80; j++) {
        const x = (j * 137 + 17) % 720,
          y = (j * 83 + g.time * ((j % 3) + 1) * 15) % 480;
        circle(x, y, j % 7 === 0 ? 1.6 : 0.7, j % 3 ? '#a7bad369' : '#f5d3a3');
      }
      circle(623, 108, 81, '#57648235');
      c.strokeStyle = '#94a3b124';
      c.lineWidth = 13;
      c.beginPath();
      c.ellipse(623, 108, 132, 25, -0.5, 0, Math.PI * 2);
      c.stroke();
      for (const s of g.shots) {
        rect(
          s.x - 2,
          s.y - 6,
          s.enemy ? 5 : 4,
          s.enemy ? 11 : 20,
          s.enemy ? '#ec9e88' : '#b7e6dd',
          3,
        );
      }
      for (const e of g.enemies) {
        c.save();
        c.translate(e.x, e.y);
        if (e.boss) {
          rect(-58, -18, 116, 37, '#8e809e', 12);
          rect(-27, -29, 54, 55, '#b5a3bc', 9);
          circle(0, 4, 16, '#edbd7b');
          rect(-53, 25, 106, 5, '#2b2949', 2);
          rect(-53, 25, (106 * Math.max(0, e.hp)) / 65, 5, '#ebbc80', 2);
          for (const x of [-46, 46]) rect(x - 7, -7, 14, 42, '#655a80', 4);
        } else {
          c.fillStyle = '#c18d99';
          c.beginPath();
          c.moveTo(0, 22);
          c.lineTo(-24, -12);
          c.lineTo(0, -3);
          c.lineTo(24, -12);
          c.closePath();
          c.fill();
          circle(0, 0, 6, '#f4cea0');
        }
        c.restore();
      }
      if (!g.invulnerable || Math.floor(g.time * 12) % 2) {
        c.save();
        c.translate(g.x, g.y);
        circle(0, 2, g.shield ? 38 : 27, g.shield ? '#a0e1d344' : '#94e9dc0c');
        c.fillStyle = '#a7d6ca';
        c.beginPath();
        c.moveTo(0, -25);
        c.lineTo(-24, 18);
        c.lineTo(-7, 12);
        c.lineTo(0, 18);
        c.lineTo(7, 12);
        c.lineTo(24, 18);
        c.closePath();
        c.fill();
        rect(-5, -9, 10, 20, '#43617c', 4);
        line(
          [
            [-6, 19],
            [0, 28 + Math.sin(g.time * 25) * 5],
            [6, 19],
          ],
          '#efce95',
          4,
        );
        c.restore();
      }
      text('NOVA / COURIER', 22, 31, 14, '#b5c5dd');
      text(`WAVE ${g.wave || 1} / 4`, 700, 31, 14, '#e4c6a4', 'right');
      for (let j = 0; j < g.hp; j++)
        rect(22 + j * 20, 438, 14, 18, '#9ed0c5', 3);
      text(String(g.score).padStart(6, '0'), 695, 455, 20, '#e6dcc3', 'right');
      break;
    }
    case 'platform': {
      backdrop('#b6cebd', '#e6dec1');
      circle(608 - g.camera * 0.09, 88, 43, '#fff0bd');
      for (let layer = 0; layer < 3; layer++) {
        c.fillStyle = ['#91aca0', '#7b9b87', '#668772'][layer];
        c.beginPath();
        c.moveTo(0, 440);
        for (let j = -1; j < 10; j++) {
          const x = j * 170 - ((g.camera * (0.1 + layer * 0.09)) % 170),
            y = 225 + layer * 45 - Math.sin(j * 2 + layer) * 50;
          c.lineTo(x, y);
        }
        c.lineTo(720, 480);
        c.closePath();
        c.fill();
      }
      for (let j = 0; j < 5; j++) {
        const x = ((((j * 230 - g.camera * 0.12) % 960) + 960) % 960) - 100;
        rect(x, 82 + (j % 2) * 40, 70, 13, '#f1efdb99', 10);
        rect(x + 18, 70 + (j % 2) * 40, 32, 20, '#f1efdb99', 10);
      }
      c.save();
      c.translate(-g.camera, 0);
      for (const p of g.platforms) {
        rect(p.x, p.y + 4, p.w, p.h, '#806c50', 5);
        rect(p.x, p.y, p.w, 10, '#678649', 5);
        rect(p.x + 3, p.y + 3, p.w - 6, 3, '#adc286', 2);
        for (let j = 0; j < p.w / 31; j++)
          rect(p.x + j * 31 + 8, p.y + 22, 11, 5, '#9a8058', 2);
      }
      for (const cp of [64, 905]) {
        rect(cp - 3, 341, 5, 58, '#d8d0ad', 2);
        c.fillStyle = g.checkpoint === cp ? '#dfaa6b' : '#7f9c88';
        c.beginPath();
        c.moveTo(cp, 343);
        c.lineTo(cp + 29, 350);
        c.lineTo(cp, 365);
        c.fill();
      }
      for (const coin of g.coins)
        if (!coin.taken) {
          circle(
            coin.x,
            coin.y + Math.sin(g.time * 3 + coin.x) * 3,
            16,
            '#f2df9133',
          );
          star(
            coin.x,
            coin.y + Math.sin(g.time * 3 + coin.x) * 3,
            11,
            '#f8db86',
          );
        }
      for (const e of g.enemies)
        if (!e.dead) {
          rect(e.x - 15, 370, 30, 25, '#977370', 10);
          circle(e.x - 6, 379, 3, '#f9e8ce');
          circle(e.x + 6, 379, 3, '#f9e8ce');
          rect(e.x - 13, 394, 9, 5, '#594d45', 2);
          rect(e.x + 4, 394, 9, 5, '#594d45', 2);
        }
      rect(1720, 325, 65, 75, '#b8916a', 4);
      rect(1742, 363, 22, 37, '#536e65', 3);
      c.fillStyle = '#566f5d';
      c.beginPath();
      c.moveTo(1708, 331);
      c.lineTo(1752, 292);
      c.lineTo(1795, 331);
      c.fill();
      text('POST', 1752, 351, 11, '#f5e5b7', 'center');
      if (!g.invulnerable || Math.floor(g.time * 10) % 2) {
        rect(g.x - 12, g.y - 10, 24, 27, '#d7ab72', 6);
        rect(g.x - 16, g.y + 1, 8, 15, '#55715f', 3);
        circle(g.x, g.y - 14, 12, '#eac8a1');
        rect(g.x - 14, g.y - 26, 28, 9, '#537762', 3);
        rect(g.x - 9, g.y - 32, 19, 10, '#69886b', 4);
        circle(g.x + 5, g.y - 16, 1.5, '#374f44');
        rect(g.x - 10, g.y + 14, 8, 6, '#4e6557', 2);
        rect(g.x + 3, g.y + 14, 8, 6, '#4e6557', 2);
      }
      c.restore();
      rect(16, 15, 165, 40, '#405e51e0', 10);
      text(`★ ${g.coins.filter((v) => v.taken).length} / 12`, 31, 41, 19);
      text(`♥ ${g.lives}`, 696, 42, 23, '#446b54', 'right');
      break;
    }
    case 'sokoban': {
      backdrop('#ece0c7', '#cbb69b');
      for (let j = 0; j < 15; j++)
        line(
          [
            [j * 60, 0],
            [j * 60, 480],
          ],
          '#a0886a17',
          1,
        );
      text('PAWS / WAREHOUSE', 28, 35, 14, '#83694f');
      text(`ROOM ${g.level + 1} / 5`, 692, 35, 14, '#83694f', 'right');
      const size = Math.min(50, 360 / g.height),
        ox = 360 - (g.width * size) / 2,
        oy = 60 + (360 - g.height * size) / 2;
      rect(
        ox - 9,
        oy - 9,
        g.width * size + 18,
        g.height * size + 22,
        '#a18b6a',
        10,
      );
      for (let y = 0; y < g.height; y++)
        for (let x = 0; x < g.width; x++) {
          const p = y * g.width + x,
            px = ox + x * size,
            py = oy + y * size;
          rect(px, py, size, size, '#d2bb97');
          rect(
            px + 2,
            py + 2,
            size - 4,
            size - 4,
            (x + y) % 2 ? '#e5d4b3' : '#dcc8a5',
            2,
          );
          if (g.walls.includes(p)) {
            rect(px + 1, py + 2, size - 2, size - 2, '#6b7c70', 3);
            rect(px + 3, py + 2, size - 6, 5, '#91a092', 2);
            line(
              [
                [px + 3, py + size * 0.5],
                [px + size - 3, py + size * 0.5],
              ],
              '#50675c',
              2,
            );
            line(
              [
                [px + size / 2, py + 4],
                [px + size / 2, py + size / 2],
              ],
              '#50675c',
              2,
            );
          }
          if (g.goals.includes(p)) {
            circle(px + size / 2, py + size / 2, 13, '#b0845d44');
            star(px + size / 2, py + size / 2, 10, '#a87c4e');
          }
          if (g.boxes.includes(p)) {
            const yes = g.goals.includes(p);
            rect(px + 5, py + 7, size - 10, size - 9, '#725d4599', 5);
            rect(
              px + 5,
              py + 4,
              size - 10,
              size - 10,
              yes ? '#82a17c' : '#ba8a57',
              4,
            );
            rect(
              px + 9,
              py + 8,
              size - 18,
              size - 18,
              yes ? '#a2bc91' : '#dab37f',
              3,
            );
            line(
              [
                [px + 10, py + 11],
                [px + size - 10, py + size - 11],
              ],
              yes ? '#6d9267' : '#ad7b4e',
              4,
            );
            line(
              [
                [px + size - 10, py + 11],
                [px + 10, py + size - 11],
              ],
              yes ? '#6d9267' : '#ad7b4e',
              4,
            );
          }
        }
      const px = ox + ((g.player % g.width) + 0.5) * size,
        py = oy + (Math.floor(g.player / g.width) + 0.5) * size;
      circle(px, py + 7, 15, '#846e5140');
      circle(px, py, 16, '#edc582');
      c.fillStyle = '#edc582';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(px + s * 5, py - 10);
        c.lineTo(px + s * 15, py - 22);
        c.lineTo(px + s * 16, py - 2);
        c.fill();
      }
      circle(px - 6, py - 1, 2, '#574c3f');
      circle(px + 6, py - 1, 2, '#574c3f');
      circle(px, py + 5, 2, '#bc7b68');
      text(`${g.moves} MOVES`, 360, 451, 15, '#80694e', 'center');
      if (g.solved) {
        rect(165, 193, 390, 84, '#365e50f2', 15);
        text('仓库整理完成', 360, 228, 26, '#f1e2bb', 'center');
        text(
          g.status === 'won' ? '全部五关完成' : '空格 / 下一关',
          360,
          254,
          14,
          '#b6cead',
          'center',
        );
      }
      break;
    }
    case 'reversi': {
      backdrop('#1d303f', '#3f5962');
      circle(619, 94, 38, '#d9d7b7');
      circle(635, 82, 36, '#233c4b');
      for (let j = 0; j < 20; j++)
        circle((j * 139 + 24) % 720, (j * 71 + 35) % 480, 1, '#c2cdb76b');
      rect(171, 51, 378, 378, '#172d35', 11);
      rect(177, 57, 366, 366, '#b3b99b', 6);
      const legal = g.turn === 1 ? reversiMoves(g.cells, 1) : [];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const p = y * 8 + x,
            px = 180 + x * 45,
            py = 60 + y * 45;
          rect(px, py, 44, 44, (x + y) % 2 ? '#59776d' : '#607f73');
          if (legal.includes(p)) circle(px + 22.5, py + 22.5, 5, '#c1d6ad80');
          if (g.cells[p]) {
            circle(px + 24, py + 25, 17, '#142f3470');
            const grad = c.createRadialGradient(
              px + 17,
              py + 15,
              2,
              px + 22,
              py + 22,
              18,
            );
            grad.addColorStop(0, g.cells[p] === 1 ? '#586666' : '#fff6de');
            grad.addColorStop(1, g.cells[p] === 1 ? '#182c32' : '#c5c4ab');
            circle(px + 22, py + 22, 17, grad as unknown as string);
          }
          if (p === g.last) circle(px + 22, py + 22, 3, '#d8ac68');
          if (p === g.cursor && g.turn === 1) {
            c.strokeStyle = '#e8cf93';
            c.lineWidth = 2;
            c.strokeRect(px + 3, py + 3, 38, 38);
          }
        }
      circle(87, 191, 19, '#1b2d34');
      text('YOU', 87, 232, 12, '#aac1b8', 'center');
      text(
        String(g.cells.filter((v) => v === 1).length),
        87,
        274,
        33,
        '#eadcb7',
        'center',
      );
      circle(633, 191, 19, '#e9e5cd');
      text('CPU', 633, 232, 12, '#aac1b8', 'center');
      text(
        String(g.cells.filter((v) => v === 2).length),
        633,
        274,
        33,
        '#eadcb7',
        'center',
      );
      text(
        g.turn === 1 ? '黑棋回合' : '白棋思考中',
        360,
        455,
        15,
        '#d5d7b9',
        'center',
      );
      break;
    }
    case 'rhythm': {
      backdrop('#25213d', '#59435e');
      for (let j = 0; j < 18; j++) {
        const x = j * 47,
          y = 305 - ((j * 43) % 120);
        rect(x, y, 37, 480 - y, '#29263e');
        for (let k = 0; k < 5; k++)
          rect(x + 9, y + 14 + k * 24, 6, 8, k % 2 ? '#a0857466' : '#d4ad8466');
      }
      const laneX = 220,
        w = 70;
      rect(212, 0, 296, 480, '#171d35dd');
      for (let lane = 0; lane < 4; lane++) {
        rect(
          laneX + lane * w,
          0,
          w - 2,
          480,
          g.lanes[lane] > 0 ? colors[lane] + '35' : '#232238',
        );
        line(
          [
            [laneX + lane * w, 0],
            [laneX + lane * w, 480],
          ],
          '#8f789a30',
          1,
        );
      }
      const hitY = 382;
      for (const n of g.notes) {
        if (n.judged) continue;
        const y = hitY - (n.at - g.time) * 200;
        if (y < -20 || y > 440) continue;
        rect(laneX + n.lane * w + 7, y - 7, w - 16, 16, colors[n.lane], 5);
        rect(laneX + n.lane * w + 11, y - 5, w - 24, 3, '#fff6', 2);
      }
      line(
        [
          [217, hitY],
          [501, hitY],
        ],
        '#f4dcc0',
        3,
      );
      ['D', 'F', 'J', 'K'].forEach((key, j) => {
        rect(
          laneX + j * w + 7,
          404,
          w - 16,
          46,
          g.lanes[j] > 0 ? colors[j] : '#5d516a',
          8,
        );
        text(
          key,
          laneX + j * w + 34,
          434,
          23,
          g.lanes[j] > 0 ? '#29213a' : '#decde0',
          'center',
        );
      });
      text('NIGHT', 107, 119, 27, '#e9d0bd', 'center');
      text('BEATS', 107, 147, 16, '#bca2bd', 'center');
      text(String(g.combo), 107, 246, 44, '#e3bfd9', 'center');
      text('COMBO', 107, 271, 12, '#bca2bd', 'center');
      text(String(g.score).padStart(6, '0'), 610, 144, 25, '#e9d0bd', 'center');
      text(
        `${Math.round((g.hits / Math.max(1, g.hits + g.misses)) * 100)}%`,
        610,
        219,
        24,
        '#afcbbb',
        'center',
      );
      text('ACCURACY', 610, 242, 11, '#aaacb9', 'center');
      rect(553, 309, 114, 8, '#2e2a43', 4);
      rect(553, 309, (114 * Math.max(0, g.health)) / 100, 8, '#b5c5a6', 4);
      if (g.flash > 0)
        text(
          g.judgement,
          360,
          185,
          27,
          g.judgement === 'MISS' ? '#efaba0' : '#f4dfb1',
          'center',
        );
      rect(220, 469, 280 * Math.min(1, g.time / 42), 3, '#dab5d5');
      break;
    }
  }
  if (g.status !== 'playing') {
    rect(0, 0, 720, 480, '#15272b60');
    rect(185, 163, 350, 145, '#f0e8d8f5', 18);
    const title =
      g.status === 'ready'
        ? '准备好了吗'
        : g.status === 'paused'
          ? '已暂停'
          : g.status === 'won'
            ? '挑战完成'
            : '本局结束';
    text(title, 360, 217, 30, '#35554d', 'center');
    text(
      g.status === 'won' || g.status === 'lost'
        ? `SCORE  ${g.score}`
        : g.status === 'ready'
          ? '点击「开始游戏」'
          : '点击「继续」',
      360,
      258,
      16,
      '#70806b',
      'center',
    );
  }
}
