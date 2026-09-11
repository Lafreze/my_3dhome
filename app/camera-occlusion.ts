import * as T from 'three';

/** Hide the visual shell only: seat anchors and collision footprints stay intact. */
export function createCameraOcclusion(groups: Map<string, T.Group>) {
  const candidates = [...groups.entries()].filter(
    ([id]) => !/window|curtain|floor|wall|art|frame/i.test(id),
  );
  const hidden = new Map<T.Object3D, boolean>();
  const held = new Map<T.Group, number>();
  const box = new T.Box3(),
    padded = new T.Box3(),
    size = new T.Vector3();
  const ray = new T.Ray(),
    direction = new T.Vector3(),
    hit = new T.Vector3();
  const restore = () => {
    for (const [mesh, visible] of hidden) mesh.visible = visible;
    hidden.clear();
  };
  return {
    restore,
    update(
      camera: T.Camera,
      target: T.Vector3,
      time: number,
      selected?: string | null,
    ) {
      let changed = false;
      direction.copy(target).sub(camera.position);
      const distance = direction.length();
      ray.set(camera.position, direction.normalize());
      for (const [id, group] of candidates) {
        let visible = true;
        for (
          let parent: T.Object3D | null = group;
          parent;
          parent = parent.parent
        )
          if (!parent.visible) visible = false;
        if (!visible || id === selected) continue;
        box.setFromObject(group);
        box.getSize(size);
        if (size.y < 0.4 || size.length() > 9) continue;
        padded.copy(box).expandByScalar(0.2);
        const obstructs =
          !padded.containsPoint(target) &&
          !!ray.intersectBox(box, hit) &&
          camera.position.distanceTo(hit) < distance - 0.3;
        if (obstructs) held.set(group, time + 0.18);
        if ((held.get(group) ?? 0) <= time) continue;
        group.traverse((object) => {
          if (object instanceof T.Mesh && object.visible) {
            hidden.set(object, object.visible);
            object.visible = false;
          }
        });
        changed = true;
      }
      return changed;
    },
    snapshot: () =>
      [...hidden.keys()].map(
        (o) => o.parent?.userData.id || o.parent?.name || o.name,
      ),
    dispose: restore,
  };
}
