import * as T from 'three';
// Deterministic, locally generated surface maps. No network texture dependency.
export function surface(
  kind: 'wood' | 'linen' | 'plaster' | 'leather',
  size = 512,
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  let seed = 17;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  c.fillStyle =
    kind === 'wood' ? '#b9a28a' : kind === 'leather' ? '#bbb4aa' : '#d8d5ce';
  c.fillRect(0, 0, size, size);
  const img = c.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let n =
        (random() - 0.5) * (kind === 'plaster' ? 22 : kind === 'wood' ? 6 : 15);
      if (kind === 'wood')
        n +=
          Math.sin(
            y * 0.68 + Math.sin(x * 0.015) * 2 + Math.sin(y * 0.03) * 4,
          ) *
            3 +
          Math.sin(y * 0.21 + x * 0.004) * 2;
      if (kind === 'linen')
        n += (x % 4 === 0 ? 13 : -3) + (y % 4 === 0 ? 12 : -3);
      if (kind === 'leather') n += Math.sin(x * 2 + y * 3) * 4;
      for (let k = 0; k < 3; k++) img.data[i + k] += n;
    }
  c.putImageData(img, 0, 0);
  if (kind === 'wood')
    for (let i = 0; i < 75; i++) {
      const y = random() * size;
      c.strokeStyle = `rgba(66,40,23,${random() * 0.13})`;
      c.lineWidth = random() * 1.4;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(160, y - 5, 330, y + 6, 512, y);
      c.stroke();
    }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
export function artwork(index: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 960;
  const c = canvas.getContext('2d')!;
  c.fillStyle = ['#e5e1d1', '#dd623f', '#d9dfda'][index % 3];
  c.fillRect(0, 0, 768, 960);
  c.fillStyle = '#252e27';
  c.font = '22px sans-serif';
  c.fillText('S T U D I O   /   S A T O R I', 64, 78);
  c.fillRect(64, 100, 640, 2);
  if (index % 3 === 0) {
    c.fillStyle = '#b7bba0';
    c.beginPath();
    c.arc(384, 460, 254, Math.PI, 0);
    c.lineTo(638, 750);
    c.lineTo(130, 750);
    c.fill();
    c.save();
    c.beginPath();
    c.rect(130, 210, 508, 540);
    c.clip();
    for (let i = 0; i < 6; i++) {
      c.fillStyle = [
        '#c8c5ac',
        '#a3aa89',
        '#828d70',
        '#65755e',
        '#405b48',
        '#294b3e',
      ][i];
      c.beginPath();
      c.moveTo(100, 570 + i * 38);
      c.bezierCurveTo(220, 330 + i * 55, 470, 770 - i * 22, 670, 420 + i * 60);
      c.lineTo(670, 800);
      c.lineTo(100, 800);
      c.fill();
    }
    c.restore();
    c.fillStyle = '#ede2b8';
    c.beginPath();
    c.arc(470, 335, 54, 0, Math.PI * 2);
    c.fill();
  } else if (index % 3 === 1) {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        c.fillStyle = (i + j) % 2 ? '#ede5cd' : '#343d31';
        c.beginPath();
        c.arc(
          174 + j * 210,
          270 + i * 142,
          67,
          0,
          Math.PI * ((i + j) % 2 ? 2 : 1),
        );
        c.fill();
      }
  } else {
    c.fillStyle = '#365856';
    for (let i = 0; i < 9; i++) {
      c.lineWidth = 12;
      c.strokeStyle = i % 2 ? '#648077' : '#365856';
      c.beginPath();
      c.moveTo(90, 220 + i * 57);
      c.bezierCurveTo(280, 60 + i * 64, 400, 560 + i * 28, 680, 230 + i * 55);
      c.stroke();
    }
    c.fillStyle = '#d6a151';
    c.beginPath();
    c.arc(570, 305, 75, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#252e27';
  c.font = '52px Georgia';
  c.fillText(
    ['Quiet terrain', 'Form & rhythm', 'Collected moments'][index % 3],
    64,
    850,
  );
  c.font = '18px sans-serif';
  c.fillText(
    `EXPLORATIONS                             0${index + 1}  /  2026`,
    64,
    900,
  );
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function screenTexture(images: CanvasImageSource[] = []) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#202c29';
  c.fillRect(0, 0, 1024, 640);
  c.fillStyle = '#eeeadf';
  c.font = '24px sans-serif';
  c.fillText('SATORI  /  SELECTED WORK', 54, 65);
  c.fillStyle = '#a6b29d';
  c.font = '16px sans-serif';
  c.fillText('A COLLECTION OF IDEAS & OBSERVATIONS', 54, 103);
  for (let i = 0; i < 3; i++) {
    if (images[i]) c.drawImage(images[i], 54 + i * 321, 155, 280, 350);
    else {
      const t = artwork(i);
      c.drawImage(t.image as HTMLCanvasElement, 54 + i * 321, 155, 280, 350);
      t.dispose();
    }
  }
  c.fillStyle = '#c8cabc';
  c.font = '16px sans-serif';
  c.fillText(
    '01 — SPACES                       02 — FORMS                      03 — MOMENTS',
    54,
    552,
  );
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
