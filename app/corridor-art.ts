import * as T from 'three';
export const corridorArtworks = [
  {
    id: 'fern',
    title: '蕨叶标本',
    medium: '植物铜版画',
    width: 0.72,
    height: 1.03,
    paper: '#e9dfc5',
    frame: '#846d49',
  },
  {
    id: 'coast',
    title: '潮汐与灯塔',
    medium: '海岸水彩',
    width: 0.92,
    height: 0.7,
    paper: '#dedfd2',
    frame: '#e1d6bd',
  },
  {
    id: 'citrus',
    title: '柠檬与蓝瓶',
    medium: '静物油画',
    width: 0.72,
    height: 0.89,
    paper: '#b8c1b0',
    frame: '#675846',
  },
  {
    id: 'tram',
    title: '转角电车',
    medium: '城市版画',
    width: 0.81,
    height: 1.01,
    paper: '#d9c9ab',
    frame: '#8a6548',
  },
  {
    id: 'moon',
    title: '月相观测',
    medium: '天文图谱',
    width: 0.78,
    height: 0.93,
    paper: '#313f50',
    frame: '#aa9364',
  },
  {
    id: 'heron',
    title: '芦苇间的鹭',
    medium: '水墨写生',
    width: 0.66,
    height: 1.1,
    paper: '#e7e2d2',
    frame: '#555b50',
  },
  {
    id: 'jazz',
    title: '午夜三重奏',
    medium: '音乐海报',
    width: 0.76,
    height: 0.98,
    paper: '#bd805a',
    frame: '#3e4743',
  },
  {
    id: 'tiles',
    title: '庭院几何',
    medium: '拼色构成',
    width: 0.88,
    height: 0.72,
    paper: '#e9d8b7',
    frame: '#947253',
  },
] as const;
export function corridorArtTexture(index: number, textures: T.Texture[]) {
  const spec = corridorArtworks[index],
    cv = document.createElement('canvas');
  cv.width = 768;
  cv.height = Math.round((768 * spec.height) / spec.width);
  const c = cv.getContext('2d')!,
    w = cv.width,
    h = cv.height;
  c.scale(w / 768, h / 960);
  c.fillStyle = spec.paper;
  c.fillRect(0, 0, 768, 960);
  const path = (points: number[][], color: string, width = 3) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  const oval = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string,
    rot = 0,
  ) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    c.fill();
  };
  switch (spec.id) {
    case 'fern':
      path(
        [
          [230, 830],
          [360, 530],
          [442, 180],
        ],
        '#687650',
        5,
      );
      for (let i = 0; i < 15; i++)
        for (const side of [-1, 1]) {
          const y = 245 + i * 34,
            x = 430 - i * 9,
            len = 25 + Math.sin((i / 15) * Math.PI) * 115;
          oval(
            x + side * len * 0.42,
            y - 15,
            len * 0.57,
            12,
            '#6a7b57',
            side * 0.58,
          );
          path(
            [
              [x, y],
              [x + side * len * 0.9, y - 40],
            ],
            '#bac09a',
            1,
          );
        }
      c.fillStyle = '#5a634a';
      c.font = '28px serif';
      c.fillText('POLYSTICHUM', 170, 880);
      break;
    case 'coast':
      c.fillStyle = '#b9ced0';
      c.fillRect(0, 0, 768, 560);
      c.fillStyle = '#759fa8';
      c.fillRect(0, 560, 768, 400);
      c.fillStyle = '#6b8071';
      c.beginPath();
      c.moveTo(0, 780);
      c.lineTo(350, 480);
      c.lineTo(650, 650);
      c.lineTo(768, 960);
      c.lineTo(0, 960);
      c.fill();
      c.fillStyle = '#ede4c8';
      c.fillRect(362, 325, 65, 245);
      c.fillStyle = '#a36e52';
      c.fillRect(355, 319, 79, 30);
      path(
        [
          [353, 320],
          [396, 273],
          [436, 320],
        ],
        '#a36e52',
        15,
      );
      c.fillStyle = '#5b737e';
      c.fillRect(384, 373, 21, 37);
      for (let i = 0; i < 18; i++)
        path(
          [
            [30 + i * 43, 645 + (i % 4) * 37],
            [75 + i * 43, 641 + (i % 4) * 37],
          ],
          '#d1dfd7',
          4,
        );
      break;
    case 'citrus':
      c.fillStyle = '#866c53';
      c.fillRect(0, 685, 768, 275);
      oval(443, 713, 155, 33, '#6d6654');
      c.fillStyle = '#4e7684';
      c.beginPath();
      c.moveTo(415, 670);
      c.bezierCurveTo(320, 440, 480, 550, 441, 310);
      c.lineTo(501, 310);
      c.bezierCurveTo(456, 534, 610, 441, 526, 670);
      c.fill();
      oval(250, 721, 165, 30, '#e7d5ac');
      for (let i = 0; i < 3; i++) {
        oval(
          163 + i * 81,
          693 + (i % 2) * 18,
          58,
          37,
          '#dcbf57',
          -0.2 + i * 0.3,
        );
        oval(159 + i * 81, 683 + (i % 2) * 18, 40, 19, '#e9ce74', -0.2);
      }
      path(
        [
          [475, 400],
          [415, 213],
          [550, 132],
        ],
        '#56664a',
        6,
      );
      oval(424, 231, 78, 20, '#627750', 0.5);
      oval(509, 162, 79, 19, '#526b48', -0.45);
      break;
    case 'tram':
      for (let i = 0; i < 6; i++) {
        c.fillStyle = ['#bf9e77', '#c9b18b', '#a89176'][i % 3];
        c.fillRect(i * 141 - 45, 100 + (i % 3) * 70, 130, 560);
        for (let j = 0; j < 4; j++)
          for (let k = 0; k < 2; k++) {
            c.fillStyle = '#6c7870';
            c.fillRect(
              i * 141 - 15 + k * 51,
              160 + j * 98 + (i % 3) * 40,
              26,
              53,
            );
          }
      }
      path(
        [
          [250, 960],
          [428, 520],
        ],
        '#696e66',
        8,
      );
      path(
        [
          [630, 960],
          [476, 520],
        ],
        '#696e66',
        8,
      );
      c.fillStyle = '#557267';
      c.fillRect(245, 505, 299, 268);
      c.fillStyle = '#dfd6b7';
      c.fillRect(262, 534, 266, 120);
      c.fillStyle = '#667b76';
      for (let i = 0; i < 3; i++) c.fillRect(275 + i * 83, 550, 65, 86);
      oval(300, 720, 23, 23, '#eee0a9');
      oval(493, 720, 23, 23, '#eee0a9');
      path(
        [
          [0, 258],
          [768, 370],
        ],
        '#5e6157',
        4,
      );
      break;
    case 'moon':
      for (let i = 0; i < 70; i++)
        oval(
          34 + ((i * 137) % 705),
          45 + ((i * 211) % 852),
          i % 5 === 0 ? 3 : 1.5,
          2,
          '#d4d3b7',
        );
      for (let i = 0; i < 7; i++) {
        const x = 132 + (i % 3) * 251,
          y = 238 + Math.floor(i / 3) * 248;
        oval(x, y, 73, 73, '#d5d6bd');
        if (i !== 3) {
          oval(x + (i - 3) * 17, y, 69, 72, '#313f50');
        }
        path(
          [
            [x - 82, y + 92],
            [x + 82, y + 92],
          ],
          '#899795',
          2,
        );
      }
      c.fillStyle = '#d8d6b9';
      c.font = '38px serif';
      c.fillText('LUNAR ATLAS', 230, 910);
      break;
    case 'heron':
      for (let i = 0; i < 18; i++) {
        const x = 40 + i * 43;
        path(
          [
            [x, 960],
            [x + Math.sin(i) * 53, 430 + (i % 5) * 59],
          ],
          '#a2a58a',
          3,
        );
        oval(x + Math.sin(i) * 53, 428 + (i % 5) * 59, 10, 55, '#8d947c', 0.18);
      }
      oval(405, 618, 92, 147, '#f4eee0', 0.4);
      path(
        [
          [375, 700],
          [345, 882],
          [299, 900],
        ],
        '#5b6862',
        7,
      );
      path(
        [
          [431, 728],
          [431, 891],
          [483, 902],
        ],
        '#5b6862',
        7,
      );
      path(
        [
          [423, 530],
          [476, 389],
          [422, 276],
          [468, 230],
        ],
        '#f6f0e5',
        38,
      );
      oval(472, 230, 34, 28, '#f6f0e5');
      path(
        [
          [493, 235],
          [597, 262],
        ],
        '#a99b70',
        13,
      );
      oval(482, 224, 5, 5, '#4e5d55');
      break;
    case 'jazz':
      c.fillStyle = '#e3d2ae';
      c.font = 'bold 88px serif';
      c.fillText('BLUE HOUR', 66, 153);
      c.font = '26px monospace';
      c.fillText('PIANO / BASS / TRUMPET', 101, 216);
      c.fillStyle = '#344b4b';
      c.fillRect(80, 641, 280, 175);
      for (let i = 0; i < 10; i++) {
        c.fillStyle = i % 3 ? '#e4d5b6' : '#3d4a45';
        c.fillRect(90 + i * 25, 689, 23, 108);
      }
      oval(545, 613, 78, 140, '#dcc29a', 0.1);
      path(
        [
          [540, 665],
          [563, 361],
        ],
        '#354845',
        20,
      );
      for (let i = 0; i < 4; i++)
        path(
          [
            [533 + i * 8, 736],
            [556 + i * 7, 352],
          ],
          '#866845',
          2,
        );
      path(
        [
          [252, 439],
          [364, 499],
          [433, 432],
        ],
        '#d5b572',
        38,
      );
      oval(434, 429, 45, 20, '#e4c990', -0.6);
      break;
    case 'tiles':
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++) {
          const x = 40 + col * 174,
            y = 114 + row * 247;
          c.fillStyle = ['#657e6b', '#b77957', '#d8bc79', '#7d9193'][
            (row + col) % 4
          ];
          c.beginPath();
          c.moveTo(x, y + 207);
          c.arc(x + 80, y + 80, 80, Math.PI, 0);
          c.lineTo(x + 160, y + 207);
          c.fill();
          if ((row + col) % 2 === 0) oval(x + 80, y + 80, 30, 30, '#e9d8b7');
        }
      break;
  }
  // Pigment grain changes marks, without repeating the subject or silhouette.
  for (let i = 0; i < 7000; i++) {
    c.fillStyle = i % 2 ? '#fffaf20c' : '#34493608';
    c.fillRect((i * 127.13) % 768, (i * 311.71) % 960, 2, 2);
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  textures.push(tex);
  return tex;
}
