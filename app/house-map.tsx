import { rooms, roomIds, houseBounds, type RoomId } from './house-data';
import { houseDoorLayout } from './house-door-layout';

const colors: Record<RoomId, string> = {
  study: '#e0dccb',
  living: '#e5d5c5',
  bedroom: '#d4dee0',
  gallery: '#ece3d4',
  cafe: '#e3c9a8',
  gaming: '#d4dec0',
  bar: '#cbb99d',
  library: '#d7c8ac',
  corridor: '#eee7d9',
  garden: '#d6e2c8',
};
const width = houseBounds.maxX - houseBounds.minX,
  depth = houseBounds.maxZ - houseBounds.minZ;

/** A small DOM map: opening it never mounts or activates a whole-house WebGL scene. */
export default function HouseMap({
  current,
  onVisit,
}: {
  current: RoomId;
  onVisit: (room: RoomId) => void;
}) {
  return (
    <div className="house-map">
      <div className="house-map-caption">
        <span>北 ↑</span>
        <span>点击房间进入</span>
      </div>
      <div
        className="house-map-grid"
        style={{
          aspectRatio: `${width} / ${depth}`,
          maxWidth: `calc(57dvh * ${width / depth})`,
        }}
      >
        {roomIds.map((id) => {
          const r = rooms[id],
            active = id === current;
          return (
            <button
              key={id}
              className={`house-map-room ${id === 'corridor' ? 'map-corridor' : ''} ${active ? 'is-current' : ''}`}
              style={{
                left: `${((r.x - r.width / 2 - houseBounds.minX) / width) * 100}%`,
                top: `${((r.z - r.depth / 2 - houseBounds.minZ) / depth) * 100}%`,
                width: `${(r.width / width) * 100}%`,
                height: `${(r.depth / depth) * 100}%`,
                background: colors[id],
              }}
              aria-label={`进入${r.name}`}
              aria-current={active ? 'location' : undefined}
              onClick={() => onVisit(id)}
            >
              <span className="house-map-number">{r.number}</span>
              <strong>
                {id === 'corridor'
                  ? '连廊'
                  : id === 'garden'
                    ? '植物园'
                    : r.name}
              </strong>
              {active && <small>当前位置</small>}
            </button>
          );
        })}
        <svg
          className="house-map-openings"
          viewBox={`0 0 ${width} ${depth}`}
          aria-hidden="true"
        >
          {houseDoorLayout.map((d) => {
            const dx = Math.cos(d.yaw) * 0.5,
              dz = -Math.sin(d.yaw) * 0.5;
            return (
              <line
                key={d.id}
                x1={d.x - houseBounds.minX - dx}
                y1={d.z - houseBounds.minZ - dz}
                x2={d.x - houseBounds.minX + dx}
                y2={d.z - houseBounds.minZ + dz}
                stroke="#fffcf3"
                strokeWidth=".24"
              />
            );
          })}
        </svg>
      </div>
      <p className="house-map-note">
        南侧入口 · 咖啡厅
        <br />
        东侧连廊连接藏书室、游戏房和酒吧，植物园位于最东侧。
      </p>
    </div>
  );
}
