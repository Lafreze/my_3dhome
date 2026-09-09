import {
  collectionCards,
  lifeStorageKey,
  type CollectionData,
  type CollectionId,
  type ActorId,
} from './life-data.ts';
import { roomIds, type RoomId } from './house-data.ts';
export function readCollections(): CollectionData {
  try {
    const data = JSON.parse(localStorage.getItem(lifeStorageKey) || '{}');
    if (data.version !== 1 || !data.cards) return {};
    return Object.fromEntries(
      Object.entries(data.cards).filter(([id, raw]) => {
        const r = raw as Record<string, unknown>;
        return (
          id in collectionCards &&
          r?.version === 1 &&
          typeof r.collectedAt === 'string' &&
          Number.isFinite(Date.parse(r.collectedAt)) &&
          roomIds.includes(r.sourceRoom as RoomId) &&
          ['resident', 'cat', 'rabbit', 'bird', 'robot'].includes(
            r.sourceActor as string,
          )
        );
      }),
    ) as CollectionData;
  } catch {
    return {};
  }
}
export function createCollectionStore(
  onCollect: (id: CollectionId, data: CollectionData, saved: boolean) => void,
) {
  let cards = readCollections();
  return {
    collect(id: CollectionId, sourceActor: ActorId, sourceRoom: RoomId) {
      // Merge another tab's acquisitions before awarding, including in-memory fallback.
      cards = { ...readCollections(), ...cards };
      if (cards[id]) return false;
      cards[id] = {
        collectedAt: new Date().toISOString(),
        sourceActor,
        sourceRoom,
        version: 1,
      };
      let saved = true;
      try {
        localStorage.setItem(
          lifeStorageKey,
          JSON.stringify({ version: 1, cards }),
        );
      } catch {
        saved = false;
      }
      onCollect(id, { ...cards }, saved);
      return true;
    },
    snapshot: () => ({ ...cards }),
  };
}
