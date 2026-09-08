'use client';
import { Check, Palette } from 'lucide-react';
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
        <div className="visitor-option-row">
          <span id="visitor-character-label">人物</span>
          <fieldset
            className="visitor-segments"
            aria-labelledby="visitor-character-label"
          >
            {appearanceOptions.characters.map((character) => (
              <button
                key={character.id}
                type="button"
                aria-pressed={appearance.character === character.id}
                onClick={() =>
                  onChange({
                    ...appearance,
                    character: character.id as Appearance['character'],
                    ...appearanceOptions.characterColors[
                      character.id as Appearance['character']
                    ],
                  })
                }
              >
                {character.label}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="visitor-colors">
          {(Object.keys(appearanceOptions.colors) as AppearanceColor[]).map(
            (key) => (
              <div className="visitor-color-row" key={key}>
                <span id={`visitor-${key}`}>{labels[key]}</span>
                <fieldset
                  aria-labelledby={`visitor-${key}`}
                  className="visitor-swatches"
                >
                  {appearanceOptions.colors[key].map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      style={{ backgroundColor: c.value }}
                      aria-label={`${labels[key]} · ${c.label}`}
                      title={c.label}
                      aria-pressed={appearance[key] === c.value}
                      onClick={() =>
                        onChange({ ...appearance, [key]: c.value })
                      }
                    >
                      {appearance[key] === c.value && (
                        <Check size={13} strokeWidth={2.5} />
                      )}
                    </button>
                  ))}
                  <label
                    className="visitor-custom-color"
                    title={`自定义${labels[key]}`}
                  >
                    <Palette size={15} />
                    <input
                      type="color"
                      aria-label={`自定义${labels[key]}`}
                      value={appearance[key]}
                      onChange={(e) =>
                        onChange({ ...appearance, [key]: e.target.value })
                      }
                    />
                  </label>
                </fieldset>
              </div>
            ),
          )}
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
