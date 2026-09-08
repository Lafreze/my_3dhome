import catalog from './visitor-appearance.json';
export type Character = 'bear' | 'cat' | 'fox';
export type Appearance = {
  character: Character;
  gender: 'female' | 'male';
  hairStyle: 'braids' | 'bob' | 'crop' | 'waves';
  hairColor: string;
  eyeColor: string;
  topColor: string;
  bottomColor: string;
  bearHood: boolean;
};
export type AppearanceColor =
  | 'hairColor'
  | 'eyeColor'
  | 'topColor'
  | 'bottomColor';
export const appearanceOptions = catalog;
export const defaultAppearance = catalog.defaults as Appearance;
export const appearanceStorageKey = 'satori-visitor-appearance-v2';
// Older seat snapshots and unavailable browser storage still have a complete outfit.
export function readAppearance(value: unknown): Appearance {
  const result = { ...defaultAppearance };
  if (!value || typeof value !== 'object') return result;
  const data = value as Record<string, unknown>;
  if (catalog.characters.some((c) => c.id === data.character)) {
    result.character = data.character as Character;
    Object.assign(result, catalog.characterColors[result.character]);
  }
  if (catalog.genders.some((g) => g.id === data.gender))
    result.gender = data.gender as Appearance['gender'];
  if (catalog.hairStyles.some((g) => g.id === data.hairStyle))
    result.hairStyle = data.hairStyle as Appearance['hairStyle'];
  for (const key of Object.keys(catalog.colors) as AppearanceColor[]) {
    if (typeof data[key] === 'string' && /^#[0-9a-f]{6}$/i.test(data[key]))
      result[key] = data[key].toLowerCase();
  }
  if (typeof data.bearHood === 'boolean') result.bearHood = data.bearHood;
  return result;
}
