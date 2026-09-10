'use client';

import VisitorPreview from './visitor-preview';
import {
  appearanceOptions,
  type Appearance,
  type AppearanceColor,
} from './visitor-appearance';
const labels: Record<AppearanceColor, string> = {
  hairColor: '发色',
  eyeColor: '眼睛',
  topColor: '上衣',
  bottomColor: '下装',
};
export default function VisitorWardrobe({
  appearance,
  onChange,
  disabled,
  children,
  posture = 'sit',
}: {
  appearance: Appearance;
  onChange: (a: Appearance) => void;
  disabled: boolean;
  children: React.ReactNode;
  posture?: 'sit' | 'rest';
}) {
  return (
    <div className="visitor-wardrobe">
      <div className="visitor-portrait">
        <VisitorPreview appearance={appearance} posture={posture} />
      </div>
      <fieldset className="visitor-options" disabled={disabled}>
        {children}
        <label className="visitor-name">
          人物
          <select
            aria-label="选择人物"
            value={appearance.character}
            onChange={(e) => {
              const character = e.target.value as Appearance['character'];
              onChange({
                ...appearance,
                character,
                ...appearanceOptions.characterColors[character],
              });
            }}
          >
            {appearanceOptions.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="visitor-color-pickers">
          {(Object.keys(labels) as AppearanceColor[]).map((key) => (
            <label key={key}>
              <span>{labels[key]}</span>
              <input
                type="color"
                aria-label={labels[key]}
                value={appearance[key]}
                onChange={(e) =>
                  onChange({ ...appearance, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <button
          className="visitor-color-reset"
          type="button"
          onClick={() =>
            onChange({
              ...appearance,
              ...appearanceOptions.characterColors[appearance.character],
            })
          }
        >
          恢复原配色
        </button>
      </fieldset>
    </div>
  );
}
