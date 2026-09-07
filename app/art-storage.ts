const database = 'satori-wall-art-v1';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(database, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pictures');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readArt(): Promise<Record<string, Blob>> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const output: Record<string, Blob> = {};
      const tx = db.transaction('pictures');
      const r = tx.objectStore('pictures').openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (c) {
          if (c.value instanceof Blob && typeof c.key === 'string')
            output[c.key] = c.value;
          c.continue();
        }
      };
      tx.oncomplete = () => resolve(output);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function writeArt(id: string, blob: Blob | null) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pictures', 'readwrite');
      if (blob) tx.objectStore('pictures').put(blob, id);
      else tx.objectStore('pictures').delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function compressArt(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('请选择 JPG、PNG 或 WebP 图片。');
  if (file.size > 30 * 1024 * 1024) throw new Error('图片需小于 30 MB。');
  const bitmap = await createImageBitmap(file);
  try {
    const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#f1ede2';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.86, 0.74, 0.62, 0.5]) {
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob && blob.size <= 360 * 1024) break;
    }
    if (!blob) throw new Error('图片压缩失败。');
    return blob;
  } finally {
    bitmap.close();
  }
}
