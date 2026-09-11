import { readFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const rooms = new Set([
  'study',
  'living',
  'bedroom',
  'gallery',
  'cafe',
  'gaming',
  'bar', 'library', 'garden',
  'corridor',
]);
const fail = (status, message) => Object.assign(new Error(message), { status });
export async function createRoomNotes(dataDir, now = Date.now) {
  const file = resolve(dataDir, 'room-notes.json');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let state = { version: 1, revision: 0, notes: [] },
    queue = Promise.resolve();
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (saved.version !== 1 || !Array.isArray(saved.notes))
      throw Error('Invalid room notes');
    state = saved;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const commit = (transform) => {
    const pending = queue.then(async () => {
      const next = {
        version: 1,
        revision: state.revision + 1,
        notes: transform(state.notes),
      };
      const temp = `${file}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temp, 'wx', 0o600);
        try {
          await handle.writeFile(JSON.stringify(next));
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temp, file);
      } catch (error) {
        await unlink(temp).catch(() => {});
        throw error;
      }
      state = next;
      return structuredClone(state);
    });
    queue = pending.catch(() => {});
    return pending;
  };
  return {
    snapshot: () => structuredClone(state),
    add(value) {
      if (
        !value ||
        !rooms.has(value.room) ||
        typeof value.text !== 'string' ||
        !value.text.trim() ||
        value.text.length > 240 ||
        (value.author !== undefined &&
          (typeof value.author !== 'string' || value.author.length > 16))
      )
        throw fail(400, '请写下 1～240 字，署名不超过 16 字。');
      const note = {
        id: randomUUID(),
        room: value.room,
        text: value.text.trim(),
        author: value.author?.trim() || '一位访客',
        createdAt: new Date(now()).toISOString(),
      };
      return commit((notes) => {
        if (
          notes.length >= 1000 ||
          notes.filter((n) => n.room === value.room).length >= 200
        )
          throw fail(409, '这里的便签已经贴满了，去其他房间看看吧。');
        return [...notes, note];
      });
    },
    remove(id) {
      return commit((notes) => {
        if (!notes.some((n) => n.id === id))
          throw fail(404, '这张便签已经收起了。');
        return notes.filter((n) => n.id !== id);
      });
    },
  };
}
