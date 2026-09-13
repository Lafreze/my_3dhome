'use client';
import { ArrowUpRight, Check } from 'lucide-react';
import {
  curiosities,
  curiosityIds,
  explorationProgress,
  type CuriosityId,
} from './exploration-data';
import { rooms } from './house-data';
import type { CollectionData } from './life-data';

const sketches: Record<CuriosityId, string> = {
  studyOrrery:
    'M32 68h56M60 65V30M40 49a20 8 0 1 0 40 0a20 8 0 1 0-40 0M30 49a30 14 0 1 0 60 0a30 14 0 1 0-60 0',
  livingMetronome:
    'M39 76L52 23h16l13 53ZM60 67V32M51 39h18M51 46h18M51 53h18M60 63l16-24',
  bedroomMusicBox:
    'M30 58h60v22H30ZM30 58V29h60v29M30 29l7-13h46l7 13M64 33a10 10 0 1 0 8 13a10 10 0 0 1-8-13M43 69h34',
  galleryFlipbook:
    'M25 77h70M34 76V49h52v27M41 55V24h38v31ZM43 46l10-11l10 7l13-5M87 46h12v-9',
  cafeGrinder:
    'M38 76V46h44v30ZM38 46l-3-19h50l-3 19M60 28V19h29v-7M45 55h30v14H45ZM56 61h8',
  corridorChime:
    'M35 25h50M60 25v-9M40 25v42M50 25v34M60 25v49M70 25v40M80 25v47M56 75h8v15h-8Z',
  libraryHourglass:
    'M37 22h46M37 78h46M41 22v56M79 22v56M47 26c0 17 26 29 26 47H47c0-18 26-30 26-47ZM50 31h20M51 70l9-13l9 13',
  gamingTop:
    'M28 76h64M44 47l16-10l16 10l7 10l-23 17l-23-17ZM60 37V23M41 58h38M47 48h26',
  barCoasters:
    'M29 64c0 17 62 17 62 0M29 60c0 17 62 17 62 0M29 55c0 17 62 17 62 0M29 51a31 11 0 1 0 62 0a31 11 0 1 0-62 0M52 51h16',
  gardenPinwheel:
    'M60 82V45M60 45l-26-4l11-21ZM60 45l4-26l21 11ZM60 45l26 4l-11 21ZM60 45l-4 26l-21-11Z',
};

export default function ExplorationTrail({
  data,
  onInspect,
}: {
  data: CollectionData;
  onInspect: (id: CuriosityId) => void;
}) {
  const progress = explorationProgress(data);
  return (
    <section className="exploration-trail" aria-label="漫游拾光">
      <div className="trail-intro">
        <div>
          <small>A HOUSE OF LITTLE WONDERS</small>
          <h3>
            {progress.found === progress.total
              ? '每个角落，都留下了回声。'
              : '十个角落，慢慢遇见。'}
          </h3>
        </div>
        <span className="trail-count">
          {progress.found}
          <small> / {progress.total}</small>
        </span>
      </div>
      <progress
        aria-label="漫游发现进度"
        value={progress.found}
        max={progress.total}
      />
      <p className="trail-description">
        循着线索找一件小物，亲手拨动它，等故事慢慢展开。每个房间都有一页拾光。
      </p>
      {progress.next && (
        <button
          className="trail-continue"
          onClick={() => onInspect(progress.next!)}
        >
          继续寻找 · {rooms[curiosities[progress.next].room].name}
          <ArrowUpRight size={16} />
        </button>
      )}
      <div className="trail-grid">
        {curiosityIds.map((id, index) => {
          const item = curiosities[id],
            record = data[item.collection];
          return (
            <button
              key={id}
              className={`trail-card ${record ? 'found' : ''}`}
              onClick={() => onInspect(id)}
              aria-label={`${record ? '重访' : '寻找'}${item.name}`}
            >
              <div className="trail-card-top">
                <span>
                  {String(index + 1).padStart(2, '0')} / {rooms[item.room].name}
                </span>
                {record ? <Check size={14} /> : <span>待发现</span>}
              </div>
              <svg viewBox="0 0 120 96" aria-hidden="true">
                <circle
                  cx="60"
                  cy="48"
                  r="37"
                  fill={record ? '#e9ddc2' : '#eeece2'}
                />
                <path
                  d={sketches[id]}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h4>{record ? item.title : item.name}</h4>
              <p>{record ? item.story : item.hint}</p>
              <span className="trail-card-link">
                {record ? '再看一眼' : '去这个角落'}
                <ArrowUpRight size={13} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
