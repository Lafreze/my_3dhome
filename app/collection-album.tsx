'use client';
/* oxlint-disable next/no-img-element */
import { useState } from 'react';
import { collectionCards, type CollectionData } from './life-data';
import { rooms, type RoomId } from './house-data';
import ExplorationTrail from './exploration-trail';
import type { CuriosityId } from './exploration-data';
const categories = ['小屋见闻', '创作碎片', '咖啡与器物', '漫游拾光'] as const;
const category = (id: string) =>
  id.startsWith('wander.')
    ? 3
    : id.startsWith('coffee.') || id === 'story.record'
      ? 2
      : id.startsWith('story.')
        ? 1
        : 0;
export default function CollectionAlbum({
  data,
  onVisit,
  onInspect,
}: {
  data: CollectionData;
  onVisit: (room: RoomId) => void;
  onInspect: (id: CuriosityId) => void;
}) {
  const [tab, setTab] = useState(3);
  const [postcard] = useState(() => {
    try {
      return localStorage.getItem('kuro-house-postcard-v1') || '';
    } catch {
      return '';
    }
  });
  return (
    <div className="life-album">
      <p>发现一些日常，记下一点灵感。收藏保存在当前浏览器。</p>
      <div className="collection-tabs" aria-label="收藏分类">
        {categories.map((name, i) => (
          <button aria-pressed={tab === i} key={name} onClick={() => setTab(i)}>
            {name}
          </button>
        ))}
      </div>
      {tab === 3 ? (
        <ExplorationTrail data={data} onInspect={onInspect} />
      ) : (
        <div className="life-card-grid">
          {Object.entries(collectionCards)
            .filter(([id]) => category(id) === tab)
            .map(([id, card]) => {
              const record = data[id as keyof CollectionData];
              return (
                <article
                  className={record ? 'life-card collected' : 'life-card'}
                  key={id}
                >
                  {record && id.startsWith('house.') && postcard ? (
                    <img
                      className="collection-picture"
                      src={postcard}
                      alt={card.title}
                    />
                  ) : (
                    <svg
                      className="collection-picture"
                      viewBox="0 0 240 130"
                      aria-hidden="true"
                    >
                      <rect
                        width="240"
                        height="130"
                        fill={
                          record
                            ? ['#e2e6d7', '#e4e3df', '#ebdcc6'][tab]
                            : '#eeeee7'
                        }
                      />
                      <circle cx="170" cy="38" r="21" fill="#f6eedc" />
                      <path
                        d="M20 118V40Q60 0 100 40V118M145 106H196V74H145ZM195 80Q223 82 199 96"
                        fill="none"
                        stroke="#a8ad94"
                        strokeWidth="3"
                      />
                      <text
                        x="58"
                        y="87"
                        fill="#626e54"
                        textAnchor="middle"
                        fontSize="30"
                      >
                        {record ? card.mark : '·'}
                      </text>
                    </svg>
                  )}
                  <h3>{record ? card.title : '尚未遇见'}</h3>
                  <p>{card.hint}</p>
                  {record && (
                    <>
                      <small>
                        {rooms[record.sourceRoom].name} ·{' '}
                        {new Date(record.collectedAt).toLocaleDateString()}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => onVisit(record.sourceRoom)}
                      >
                        回到这里
                      </button>
                    </>
                  )}
                </article>
              );
            })}
        </div>
      )}
    </div>
  );
}
