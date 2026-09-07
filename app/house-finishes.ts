import * as T from 'three';
import type { RoomId } from './house-data';

// Each room owns a different authored surface, including its height and roughness maps.
// The seeds and periodic grain avoid both cloned room textures and visible tile seams.
type Surface =
  | 'smoked-oak'
  | 'ash'
  | 'travertine'
  | 'boucle'
  | 'cotton'
  | 'suede'
  | 'lime'
  | 'clay'
  | 'mineral';
function makeSurface(kind: Surface, textures: T.Texture[]) {
  const size = 512,
    color = document.createElement('canvas'),
    relief = document.createElement('canvas');
  color.width = color.height = relief.width = relief.height = size;
  const c = color.getContext('2d')!,
    h = relief.getContext('2d')!;
  const pixels = c.createImageData(size, size),
    heights = h.createImageData(size, size);
  let seed =
    kind.split('').reduce((a, v) => a * 7 + v.charCodeAt(0), 13) % 2147483647;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2,
        v = (y / size) * Math.PI * 2;
      const noise = random() - 0.5;
      let n = noise * 8;
      if (kind === 'smoked-oak')
        n +=
          Math.sin(v * 58 + Math.sin(u) * 3 + Math.sin(v * 3) * 4) * 14 +
          Math.sin(v * 17 + Math.cos(u * 2)) * 7;
      if (kind === 'ash')
        n +=
          Math.sin(v * 93 + Math.sin(u * 2) * 0.9) * 7 +
          Math.cos(v * 8 + Math.sin(u)) * 9;
      if (kind === 'travertine')
        n +=
          Math.sin(v * 5 + Math.sin(u * 2) * 0.45) * 5 +
          (random() > 0.984 ? -50 : 0);
      if (kind === 'boucle')
        n += Math.sin(u * 85) * Math.sin(v * 85) * 24 + noise * 14;
      if (kind === 'cotton') n += (x % 4 < 2 ? 7 : -7) + (y % 6 < 3 ? 6 : -6);
      if (kind === 'suede') n += Math.sin(u * 120 + v * 90) * 4 + noise * 18;
      if (['lime', 'clay', 'mineral'].includes(kind))
        n +=
          Math.sin(u * 3 + Math.sin(v * 2)) * 5 +
          Math.cos(v * 4 + Math.sin(u * 3)) * 3;
      const i = (y * size + x) * 4;
      for (let j = 0; j < 3; j++) {
        pixels.data[i + j] = 222 + n;
        heights.data[i + j] = 128 + n * 2;
      }
      pixels.data[i + 3] = heights.data[i + 3] = 255;
    }
  c.putImageData(pixels, 0, 0);
  h.putImageData(heights, 0, 0);
  const map = new T.CanvasTexture(color),
    bumpMap = new T.CanvasTexture(relief);
  map.colorSpace = T.SRGBColorSpace;
  for (const t of [map, bumpMap]) {
    t.name = kind;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    textures.push(t);
  }
  return {
    map,
    bumpMap,
    normalMap: null,
    roughnessMap: bumpMap,
    bumpScale: kind === 'boucle' ? 0.014 : 0.006,
  };
}
export function houseFinishes(materials: T.Material[], textures: T.Texture[]) {
  const make = (
    color: string,
    kind: Surface,
    room: RoomId,
    roughness = 0.85,
  ) => {
    const m = new T.MeshStandardMaterial({
      color,
      ...makeSurface(kind, textures),
      roughness,
    });
    m.name = `${room}/${kind}`;
    materials.push(m);
    return m;
  };
  return {
    living: {
      wood: make('#856c52', 'smoked-oak', 'living'),
      pale: make('#b49870', 'smoked-oak', 'living'),
      dark: make('#514836', 'smoked-oak', 'living'),
      wall: make('#e2d9c8', 'lime', 'living'),
      cloth: make('#d4c8af', 'boucle', 'living'),
    },
    bedroom: {
      wood: make('#c7ac85', 'ash', 'bedroom'),
      pale: make('#d8c6a4', 'ash', 'bedroom'),
      dark: make('#8b7255', 'ash', 'bedroom'),
      wall: make('#cba18a', 'clay', 'bedroom'),
      cloth: make('#eadfc9', 'cotton', 'bedroom'),
    },
    gallery: {
      wood: make('#c5b8a0', 'travertine', 'gallery'),
      pale: make('#d5ccba', 'travertine', 'gallery'),
      dark: make('#645c50', 'travertine', 'gallery'),
      wall: make('#e8e2d4', 'mineral', 'gallery'),
      cloth: make('#b5a994', 'suede', 'gallery'),
    },
  };
}
export function galleryPrint(index: number, textures: T.Texture[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 900;
  const c = canvas.getContext('2d')!;
  c.fillStyle = ['#e1d8c4', '#dedfd6', '#d7c7b3', '#dce0ce', '#e7cbb0'][index];
  c.fillRect(0, 0, 640, 900);
  c.save();
  c.beginPath();
  c.rect(45, 45, 550, 810);
  c.clip();
  if (index === 3) {
    for (let i = 0; i < 13; i++) {
      c.fillStyle = ['#576e56', '#87917a', '#b8bca2'][i % 3];
      c.fillRect(50 + i * 45, 80, 14, 740);
      c.beginPath();
      c.ellipse(
        60 + i * 45,
        240 + (i % 3) * 130,
        70,
        140,
        -0.6,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  } else if (index === 4) {
    c.fillStyle = '#bc714b';
    c.beginPath();
    c.arc(310, 330, 160, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 7; i++) {
      c.fillStyle = i % 2 ? '#566c62' : '#a99578';
      c.fillRect(30, 570 + i * 38, 580, 22);
    }
  } else if (index === 0) {
    for (let i = 0; i < 7; i++) {
      c.strokeStyle = ['#6b7160', '#a98765', '#384c43'][i % 3];
      c.lineWidth = 23;
      c.beginPath();
      c.ellipse(320, 430, 60 + i * 38, 150 + i * 35, -0.42, 0, Math.PI * 2);
      c.stroke();
    }
  } else if (index === 1) {
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? '#52706a' : '#a9b3a0';
      c.beginPath();
      c.moveTo(80 + i * 30, 150);
      c.lineTo(120 + i * 30, 150);
      c.lineTo(490 - i * 30, 740);
      c.lineTo(450 - i * 30, 740);
      c.fill();
    }
    c.fillStyle = '#c59455';
    c.beginPath();
    c.arc(320, 450, 95, 0, Math.PI * 2);
    c.fill();
  } else {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = ['#eae1cd', '#936d52', '#344e47', '#b1aa86', '#755c4a'][i];
      c.beginPath();
      c.ellipse(
        320 + (i % 2 ? 80 : -60),
        180 + i * 138,
        170 - i * 17,
        105,
        0.3 * i,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  c.restore();
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  textures.push(texture);
  return texture;
}
