import * as T from 'three';
import { createHobbyProps } from './visitor-hobby-props.ts';
import { giftFlight } from './visitor-activities.ts';
import type { Visitor } from './seat-data';
export function createVisitorGifts(scene: T.Scene) {
  const gifts = new Map<string, ReturnType<typeof createHobbyProps>>();
  return {
    update(
      visitors: Visitor[],
      frames: Map<string, { root: T.Group }>,
      now: number,
      reduced: boolean,
    ) {
      const alive = new Set<string>();
      for (const v of visitors) {
        const e = v.gesture;
        if (
          !e?.targetId ||
          !['shareBook', 'shareFlowers', 'shareTea'].includes(e.kind)
        )
          continue;
        const sender = frames.get(v.id)?.root,
          receiver = frames.get(e.targetId)?.root;
        const progress = giftFlight(e.at, now, e.expiresAt, reduced);
        const target = visitors.find((p) => p.id === e.targetId);
        if (
          !progress ||
          !sender?.visible ||
          !receiver?.visible ||
          target?.posture === 'rest' ||
          sender.userData.moving ||
          receiver.userData.moving
        )
          continue;
        alive.add(e.id);
        let gift = gifts.get(e.id);
        if (!gift) {
          gift = createHobbyProps();
          gift.root.name = `Visitor gift / ${e.kind}`;
          scene.add(gift.root);
          gifts.set(e.id, gift);
        }
        gift.update(
          e.kind === 'shareBook' ? 3 : e.kind === 'shareFlowers' ? 5 : 2,
          progress.scale,
          0,
        );
        const from = sender.localToWorld(new T.Vector3(0.29, 0.32, 0.33)),
          to = receiver.localToWorld(new T.Vector3(-0.29, 0.32, 0.33));
        gift.root.position.copy(from.lerp(to, progress.progress));
        gift.root.position.y += progress.lift;
        gift.root.rotation.set(0.2, progress.progress * Math.PI * 0.65, 0);
      }
      for (const [id, g] of gifts)
        if (!alive.has(id)) {
          g.dispose();
          gifts.delete(id);
        }
    },
    snapshot: () => [...gifts.keys()],
    dispose() {
      gifts.forEach((g) => g.dispose());
      gifts.clear();
    },
  };
}
