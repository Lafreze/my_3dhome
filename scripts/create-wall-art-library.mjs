import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const artworks = [
  [
    'quiet-hills',
    '远山 · 雾蓝',
    '<circle cx="385" cy="245" r="90" fill="#d6bc8b"/><path d="M0 730 Q120 440 290 630 Q430 370 720 660 V1000 H0" fill="#9daaaa"/><path d="M0 850 Q140 590 360 780 Q580 640 720 800 V1000 H0" fill="#52656a"/><path d="M0 920 Q330 770 720 920 V1000 H0" fill="#344c50"/>',
  ],
  [
    'evening-window',
    '暮窗 · 暖日',
    '<path d="M120 850V350a240 240 0 0 1 480 0v500Z" fill="#cfad81"/><circle cx="360" cy="415" r="130" fill="#efcf94"/><path d="M120 700Q330 580 600 730V850H120Z" fill="#8b9581"/><path d="M120 800Q410 660 600 800V850H120Z" fill="#59675a"/><path d="M110 870h500M355 165v680M130 560h460" stroke="#f0e9d9" stroke-width="20"/>',
  ],
  [
    'botanical-study',
    '枝叶 · 鼠尾草',
    '<circle cx="380" cy="450" r="220" fill="#d9d7c4"/><path d="M200 870Q410 610 340 220" fill="none" stroke="#626e57" stroke-width="9"/>' +
      [
        [320, 350, -25],
        [365, 480, 25],
        [280, 570, -35],
        [295, 700, 30],
        [355, 255, 15],
      ]
        .map(
          ([x, y, a], i) =>
            `<ellipse cx="${x + (i % 2 ? 60 : -45)}" cy="${y}" rx="90" ry="32" fill="${i % 2 ? '#85917a' : '#586b58'}" transform="rotate(${a} ${x} ${y})"/>`,
        )
        .join(''),
  ],
];
await mkdir('public/artwork', { recursive: true });
const catalog = JSON.parse(await readFile('config/asset-catalog.json', 'utf8'));
for (const [id, name, body] of artworks) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1000" viewBox="0 0 720 1000"><rect width="720" height="1000" fill="#eee8da"/>${body}</svg>`;
  const bytes = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
  const source = `public/artwork/${id}.webp`;
  await writeFile(source, bytes);
  if (!catalog.assets.some((a) => a.id === `art.${id}`))
    catalog.assets.push({
      id: `art.${id}`,
      source,
      path: `images/artwork/${id}.webp`,
      type: 'image',
      room: 'shared',
      rooms: ['study', 'living', 'gallery'],
      license: 'CC0-1.0',
      author: 'kuro.cafe procedural artwork',
      sourceUrl: '',
      modifications:
        'Original vector compositions rendered at 720 × 1000 pixels',
      approval: 'approved',
      name,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    });
}
await writeFile(
  'config/asset-catalog.json',
  JSON.stringify(catalog, null, 2) + '\n',
);
