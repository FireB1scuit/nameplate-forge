/**
 * Bundled font registry (plan.md §7). All fonts are SIL OFL 1.1; the licence text for each ships
 * next to the font file in public/fonts/<file>-OFL.txt.
 */

export interface FontEntry {
  id: string;
  /** display name */
  name: string;
  /** short descriptive hint shown in the picker */
  hint: string;
  /** file name in public/fonts */
  file: string;
  /** CSS font-family registered via @font-face for previews */
  cssFamily: string;
  /** variable-font axis settings to use for geometry (e.g. bold weight) */
  variation?: Record<string, number>;
  /** CSS font-weight matching `variation` for previews */
  cssWeight: number;
  licence: string;
  source: string;
}

export const FONTS: FontEntry[] = [
  {
    id: 'cinzel',
    name: 'Cinzel',
    hint: 'Classical capitals',
    file: 'Cinzel.ttf',
    cssFamily: 'NF Cinzel',
    variation: { wght: 700 },
    cssWeight: 700,
    licence: 'Cinzel-OFL.txt',
    source: 'https://github.com/NDISCOVER/Cinzel',
  },
  {
    id: 'unifrakturcook',
    name: 'UnifrakturCook',
    hint: 'Blackletter',
    file: 'UnifrakturCook.ttf',
    cssFamily: 'NF UnifrakturCook',
    cssWeight: 700,
    licence: 'UnifrakturCook-OFL.txt',
    source: 'https://github.com/google/fonts/tree/main/ofl/unifrakturcook',
  },
  {
    id: 'pirataone',
    name: 'Pirata One',
    hint: 'Gothic display',
    file: 'PirataOne.ttf',
    cssFamily: 'NF Pirata One',
    cssWeight: 400,
    licence: 'PirataOne-OFL.txt',
    source: 'https://github.com/google/fonts/tree/main/ofl/pirataone',
  },
  {
    id: 'orbitron',
    name: 'Orbitron',
    hint: 'Tech',
    file: 'Orbitron.ttf',
    cssFamily: 'NF Orbitron',
    variation: { wght: 700 },
    cssWeight: 700,
    licence: 'Orbitron-OFL.txt',
    source: 'https://github.com/theleagueof/orbitron',
  },
];

export type FontId = string;
export const DEFAULT_FONT_ID = 'cinzel';

export function findFont(id: string): FontEntry | undefined {
  return FONTS.find((f) => f.id === id);
}
