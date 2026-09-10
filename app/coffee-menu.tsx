'use client';
import { drinks, type CoffeeSnapshot, type Drink } from './coffee-state';
export default function CoffeeMenu({
  state,
  onMake,
  onClear,
}: {
  state: CoffeeSnapshot;
  onMake: (drink: Drink) => void;
  onClear: () => void;
}) {
  const busy = state.phase === 'grinding' || state.phase === 'extracting';
  return (
    <div className="coffee-menu">
      <p>选一杯喜欢的。制作时可以继续逛小屋。</p>
      <div className="coffee-drinks">
        {Object.entries(drinks).map(([id, drink]) => (
          <button key={id} disabled={busy} onClick={() => onMake(id as Drink)}>
            <svg viewBox="0 0 100 80" aria-hidden="true">
              <ellipse cx="45" cy="69" rx="35" ry="6" fill="#b7a48a" />
              <path
                d="M69 25H80Q96 44 69 50"
                fill="none"
                stroke="#d4c5ac"
                strokeWidth="7"
              />
              <path d="M16 24H73L65 63Q44 75 24 63Z" fill="#e7dcc8" />
              <ellipse cx="44" cy="24" rx="28" ry="8" fill={drink.color} />
            </svg>
            <strong>{drink.name}</strong>
            <small>{drink.note}</small>
          </button>
        ))}
      </div>
      <output aria-live="polite">
        {
          {
            empty: '吧台已备好杯子。',
            grinding: '研磨中…',
            extracting: '正在萃取…',
            ready: `${drinks[state.drink].name}好了，在取餐处等你。`,
          }[state.phase]
        }
      </output>
      {state.phase === 'ready' && (
        <button className="text-button" onClick={onClear}>
          收拾杯子
        </button>
      )}
    </div>
  );
}
