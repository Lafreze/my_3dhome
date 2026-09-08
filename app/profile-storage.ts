import type { Profile } from './room-data';

const legacyKey = 'satori-studio-v1';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('satori-profile-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profile');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readProfile(): Promise<unknown> {
  let saved: unknown;
  try {
    const db = await open();
    try {
      saved = await new Promise((resolve, reject) => {
        const tx = db.transaction('profile');
        const request = tx.objectStore('profile').get('main');
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Existing browser profiles remain readable where IndexedDB is unavailable.
  }
  if (saved) return saved;
  const legacy = localStorage.getItem(legacyKey);
  return legacy ? JSON.parse(legacy) : undefined;
}
export async function writeProfile(profile: Profile): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await open();
  } catch {
    localStorage.setItem(legacyKey, JSON.stringify(profile));
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('profile', 'readwrite');
      tx.objectStore('profile').put(profile, 'main');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  // Only retire the old small localStorage copy after the database transaction succeeds.
  try {
    localStorage.removeItem(legacyKey);
  } catch {
    /* Database save is already durable. */
  }
}
