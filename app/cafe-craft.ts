import * as T from 'three';
import { interiorMaterial } from './house-finishes';

/** Lift before tilting, then straighten before lowering, so the spout clears the dripper's lip. */
export function advanceKettle(
  y: number,
  angle: number,
  pouring: boolean,
  blend: number,
) {
  const rest = 0.056,
    raised = 0.66;
  y = T.MathUtils.lerp(
    y,
    pouring || Math.abs(angle) > 0.04 ? raised : rest,
    blend,
  );
  const lift = T.MathUtils.clamp((y - rest) / (raised - rest), 0, 1);
  angle = T.MathUtils.lerp(
    angle,
    pouring ? 0.58 * T.MathUtils.smoothstep(lift, 0.5, 0.9) : 0,
    blend,
  );
  return { y, angle, stream: pouring && angle > 0.42 };
}

/** A quiet, consistent service collection, with a different light response for each material. */
export function cafeCraft(materials: T.Material[], textures: T.Texture[]) {
  const finish = (
    kind: Parameters<typeof interiorMaterial>[0],
    color: string,
  ) => interiorMaterial(kind, color, materials, textures);
  const porcelain = finish('glaze', '#f3eee5'),
    pearl = finish('glaze', '#e0ddd5'),
    oatmeal = finish('glaze', '#c9bdad'),
    foot = finish('clay', '#b9a68d'),
    walnut = finish('walnut', '#655045'),
    steel = finish('brushed-metal', '#c4c5c2'),
    champagne = finish('brushed-metal', '#baab91'),
    paper = finish('mineral', '#eee5d5'),
    linen = finish('linen', '#e5ddcf'),
    enamel = finish('glaze', '#343b39');
  porcelain.roughness = 0.22;
  pearl.roughness = 0.3;
  oatmeal.roughness = 0.33;
  for (const m of [porcelain, pearl, oatmeal]) {
    m.bumpScale = 0.00025;
    m.clearcoat = 0.52;
    m.clearcoatRoughness = 0.2;
  }
  steel.roughness = 0.3;
  steel.bumpScale = 0.00028;
  champagne.roughness = 0.43;
  enamel.roughness = 0.38;
  enamel.clearcoat = 0.25;
  enamel.bumpScale = 0.0002;
  paper.bumpScale = 0.00015;
  linen.bumpScale = 0.0006;
  const polished = steel.clone();
  polished.roughness = 0.2;
  polished.bumpScale = 0.0001;
  materials.push(polished);
  const water = new T.MeshPhysicalMaterial({
    color: '#e6eeea',
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.65,
    transmission: 0.25,
    thickness: 0.01,
    depthWrite: false,
  });
  materials.push(water);
  const names = {
    porcelain,
    pearl,
    oatmeal,
    foot,
    walnut,
    steel,
    champagne,
    paper,
    linen,
    enamel,
    polished,
    water,
  };
  for (const [name, m] of Object.entries(names))
    m.name = `Cafe craft / ${name}`;
  return names;
}

/** Typeset lettering on subtly worn charcoal slate. Prices have their own aligned column. */
export function paintCafeMenu(canvas: HTMLCanvasElement, rows: string[]) {
  const ctx = canvas.getContext('2d')!,
    w = canvas.width,
    h = canvas.height;
  const grain = ctx.createImageData(w, h);
  let seed = 4871;
  for (let i = 0; i < grain.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = (seed / 4294967296 - 0.5) * 6;
    grain.data[i] = 43 + n;
    grain.data[i + 1] = 49 + n;
    grain.data[i + 2] = 47 + n;
    grain.data[i + 3] = 255;
  }
  ctx.putImageData(grain, 0, 0);
  const margin = 72;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#bfb097';
  ctx.font = '24px sans-serif';
  ctx.fillText('S A T O R I   /   COFFEE HOUSE', margin, 70);
  ctx.fillStyle = '#f2eee3';
  ctx.font = '58px Georgia, serif';
  ctx.fillText(
    rows[0] === 'COFFEE' ? 'The coffee menu' : 'Slow moments',
    margin,
    151,
  );
  ctx.strokeStyle = '#9e9078';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin, 188);
  ctx.lineTo(w - margin, 188);
  ctx.stroke();
  rows.slice(1).forEach((line, i) => {
    const match = /^(.*?)\s+(\d+\.\d+)$/.exec(line);
    const y = 283 + i * ((h - 390) / 2);
    ctx.font = '36px Georgia, serif';
    ctx.fillStyle = '#f0eadd';
    ctx.textAlign = 'left';
    ctx.fillText(
      match ? match[1] : line,
      margin,
      y,
      w - margin * 2 - (match ? 130 : 0),
    );
    if (match) {
      ctx.textAlign = 'right';
      ctx.font = '30px sans-serif';
      ctx.fillStyle = '#c4b69f';
      ctx.fillText(match[2], w - margin, y);
    }
    ctx.strokeStyle = '#e5d8bd18';
    ctx.beginPath();
    ctx.moveTo(margin, y + 29);
    ctx.lineTo(w - margin, y + 29);
    ctx.stroke();
  });
  ctx.textAlign = 'left';
  ctx.font = '21px sans-serif';
  ctx.fillStyle = '#aea99b';
  ctx.fillText(
    rows[0] === 'COFFEE'
      ? 'SMALL BATCH  ·  FRESHLY GROUND'
      : 'SEASONAL SELECTION  ·  TAKE YOUR TIME',
    margin,
    h - 43,
  );
}
