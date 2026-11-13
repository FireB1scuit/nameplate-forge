/**
 * Font registry (plan.md §7). Bundled fonts are SIL OFL 1.1; the licence text for each ships
 * next to the font file in public/fonts/<file>-OFL.txt.
 *
 * Uploaded fonts (plan.md §3.2) are registered at runtime with an id starting `user:`. They are
 * parsed locally, never uploaded, and can't travel in share links (the link falls back to the
 * default font).
 */

export interface FontEntry {
  id: string;
  /** display name */
  name: string;
  /** short descriptive hint shown in the picker */
  hint: string;
  /** file name in public/fonts (bundled fonts only) */
  file: string;
  /** CSS font-family registered via @font-face for previews */
  cssFamily: string;
  /** variable-font axis settings to use for geometry (e.g. bold weight) */
  variation?: Record<string, number>;
  /** CSS font-weight matching `variation` for previews */
  cssWeight: number;
  licence: string;
  source: string;
  /** true for fonts the user uploaded in this session */
  user?: boolean;
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
  {
    id: 'imfell',
    name: 'IM Fell SC',
    hint: 'Old print',
    file: 'IMFellEnglishSC.ttf',
    cssFamily: 'NF IM Fell',
    cssWeight: 400,
    licence: 'IMFellEnglishSC-OFL.txt',
    source: 'https://github.com/google/fonts/tree/main/ofl/imfellenglishsc',
  },
  {
    id: 'newrocker',
    name: 'New Rocker',
    hint: 'Barbed',
    file: 'NewRocker.ttf',
    cssFamily: 'NF New Rocker',
    cssWeight: 400,
    licence: 'NewRocker-OFL.txt',
    source: 'https://github.com/google/fonts/tree/main/ofl/newrocker',
  },
  {
    id: 'metamorphous',
    name: 'Metamorphous',
    hint: 'Uncial',
    file: 'Metamorphous.ttf',
    cssFamily: 'NF Metamorphous',
    cssWeight: 400,
    licence: 'Metamorphous-OFL.txt',
    source: 'https://github.com/google/fonts/tree/main/ofl/metamorphous',
  },
];

export type FontId = string;
export const DEFAULT_FONT_ID = 'cinzel';
export const USER_PREFIX = 'user:';

/** Fonts uploaded in this session (main thread only). */
const userFonts = new Map<string, FontEntry>();

export function registerUserFont(id: string, name: string, cssFamily: string): FontEntry {
  const entry: FontEntry = {
    id,
    name,
    hint: 'Your upload',
    file: '',
    cssFamily,
    cssWeight: 400,
    licence: '',
    source: '',
    user: true,
  };
  userFonts.set(id, entry);
  return entry;
}

export function userFontList(): FontEntry[] {
  return [...userFonts.values()];
}

export function findFont(id: string): FontEntry | undefined {
  return FONTS.find((f) => f.id === id) ?? userFonts.get(id);
}

export function isUserAsset(id: string): boolean {
  return id.startsWith(USER_PREFIX);
}
