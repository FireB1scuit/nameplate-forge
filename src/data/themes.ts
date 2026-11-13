/**
 * Theme presets (plan.md §3.4). A theme is a preset of style layers — outline, border, end-caps,
 * surface — plus font defaults and viewer materials. Every layer can be changed after picking a
 * theme; the design stores the layers, not just the theme id.
 */

export type ThemeId =
  'plain' | 'riveted' | 'gothic' | 'scroll' | 'monument' | 'plank' | 'scrap' | 'xenos' | 'cog';

export const OUTLINES = [
  'rect',
  'rounded',
  'chamfer',
  'pointed',
  'scroll',
  'leaf',
  'jagged',
  'plank',
  'monument',
] as const;
export type OutlineType = (typeof OUTLINES)[number];

export const BORDERS = ['none', 'single', 'double', 'beaded'] as const;
export type BorderType = (typeof BORDERS)[number];

/** Bundled end-cap icons. 'rivet' is a 3D dome; the rest are flat raised artwork from SVG. */
export const ENDCAP_ICONS = [
  'none',
  'rivet',
  'cross',
  'skull',
  'wing',
  'cog',
  'star',
  'fleur',
] as const;
export type BundledIcon = (typeof ENDCAP_ICONS)[number];

export const SURFACES = ['smooth', 'hammered', 'wood', 'stone', 'rust'] as const;
export type SurfaceType = (typeof SURFACES)[number];

export interface BorderSpec {
  type: BorderType;
  /** line width (mm) */
  width: number;
  /** distance from the plate edge (mm) */
  inset: number;
}

export interface EndCapSpec {
  /** a bundled icon id or an uploaded SVG id ('user:…') */
  icon: string;
  /** icon height (mm) */
  size: number;
  /** at the plate ends, or right beside the text */
  place: 'ends' | 'beside';
}

export interface StyleLayers {
  outline: OutlineType;
  border: BorderSpec;
  endCaps: EndCapSpec;
  surface: SurfaceType;
}

export interface ThemeMaterial {
  color: string;
  metalness: number;
  roughness: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  layers: StyleLayers;
  /** font applied when the theme is picked */
  fontId: string;
  /** minimum plate height (mm) the theme needs to fit its border around the letters */
  plateHeight?: number;
  material: ThemeMaterial;
  /** colour of text/border/icons in the painted preview */
  paint: string;
}

const NO_BORDER: BorderSpec = { type: 'none', width: 0.3, inset: 0.35 };
const NO_CAPS: EndCapSpec = { icon: 'none', size: 2.6, place: 'ends' };

export const THEMES: Theme[] = [
  {
    id: 'plain',
    name: 'Plain',
    description: 'Rounded plate, nothing else. Cleanest print.',
    layers: { outline: 'rounded', border: NO_BORDER, endCaps: NO_CAPS, surface: 'smooth' },
    fontId: 'cinzel',
    material: { color: '#C9993F', metalness: 0.85, roughness: 0.32 },
    paint: '#1E1A14',
  },
  {
    id: 'riveted',
    name: 'Riveted Iron',
    description: 'Inset border and rivets. Looks bolted onto the rim.',
    layers: {
      outline: 'rect',
      border: { type: 'single', width: 0.3, inset: 0.35 },
      endCaps: { icon: 'rivet', size: 0.84, place: 'ends' },
      surface: 'smooth',
    },
    fontId: 'cinzel',
    plateHeight: 4.4,
    material: { color: '#9EA3AD', metalness: 0.8, roughness: 0.38 },
    paint: '#E9E4D6',
  },
  {
    id: 'gothic',
    name: 'Gothic',
    description: 'Pointed ends, a fine border, fleurs and blackletter.',
    layers: {
      outline: 'pointed',
      border: { type: 'single', width: 0.3, inset: 0.3 },
      endCaps: { icon: 'fleur', size: 2.4, place: 'ends' },
      surface: 'smooth',
    },
    fontId: 'unifrakturcook',
    plateHeight: 4.4,
    material: { color: '#D4A853', metalness: 0.9, roughness: 0.28 },
    paint: '#5A1418',
  },
  {
    id: 'scroll',
    name: 'Scroll Banner',
    description: 'A ribbon with forked tails. Reads like a battle honour.',
    layers: { outline: 'scroll', border: NO_BORDER, endCaps: NO_CAPS, surface: 'smooth' },
    fontId: 'imfell',
    material: { color: '#D8C9A3', metalness: 0.0, roughness: 0.75 },
    paint: '#3A2414',
  },
  {
    id: 'monument',
    name: 'Monument',
    description: 'Stepped stone plinth with a star at each end.',
    layers: {
      outline: 'monument',
      border: { type: 'single', width: 0.3, inset: 0.3 },
      endCaps: { icon: 'star', size: 1.8, place: 'beside' },
      surface: 'stone',
    },
    fontId: 'cinzel',
    plateHeight: 4.4,
    material: { color: '#8E8B84', metalness: 0.0, roughness: 0.85 },
    paint: '#D9B55B',
  },
  {
    id: 'plank',
    name: 'Wooden Plank',
    description: 'Rough-cut board, nailed on. Wood grain surface.',
    layers: {
      outline: 'plank',
      border: NO_BORDER,
      endCaps: { icon: 'rivet', size: 0.7, place: 'ends' },
      surface: 'wood',
    },
    fontId: 'pirataone',
    material: { color: '#7A5230', metalness: 0.0, roughness: 0.8 },
    paint: '#EDE3CC',
  },
  {
    id: 'scrap',
    name: 'Scrap Metal',
    description: 'Jagged torn sheet, skulls and rust pitting.',
    layers: {
      outline: 'jagged',
      border: NO_BORDER,
      endCaps: { icon: 'skull', size: 2.6, place: 'ends' },
      surface: 'rust',
    },
    fontId: 'newrocker',
    material: { color: '#8A5A3B', metalness: 0.55, roughness: 0.65 },
    paint: '#E7D9B8',
  },
  {
    id: 'xenos',
    name: 'Xenos Sleek',
    description: 'Smooth leaf-shaped blade with a fine inlaid line.',
    layers: {
      outline: 'leaf',
      border: { type: 'single', width: 0.3, inset: 0.3 },
      endCaps: NO_CAPS,
      surface: 'smooth',
    },
    fontId: 'metamorphous',
    plateHeight: 4.4,
    material: { color: '#4E9C8A', metalness: 0.65, roughness: 0.25 },
    paint: '#F1E9C9',
  },
  {
    id: 'cog',
    name: 'Forge Cog',
    description: 'Hammered bronze, beaded border and cogs.',
    layers: {
      outline: 'chamfer',
      border: { type: 'beaded', width: 0.4, inset: 0.3 },
      endCaps: { icon: 'cog', size: 2.6, place: 'ends' },
      surface: 'hammered',
    },
    fontId: 'orbitron',
    plateHeight: 4.4,
    material: { color: '#B0703A', metalness: 0.85, roughness: 0.42 },
    paint: '#1A1612',
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function themeLayers(id: string): StyleLayers {
  return structuredClone(getTheme(id).layers);
}

export const OUTLINE_LABELS: Record<OutlineType, string> = {
  rect: 'Rectangle',
  rounded: 'Rounded',
  chamfer: 'Chamfered',
  pointed: 'Pointed',
  scroll: 'Scroll',
  leaf: 'Leaf',
  jagged: 'Jagged',
  plank: 'Plank',
  monument: 'Monument',
};

export const SURFACE_LABELS: Record<SurfaceType, string> = {
  smooth: 'Smooth',
  hammered: 'Hammered',
  wood: 'Wood grain',
  stone: 'Stone',
  rust: 'Rust pitting',
};

export const ICON_LABELS: Record<BundledIcon, string> = {
  none: 'None',
  rivet: 'Rivet',
  cross: 'Cross',
  skull: 'Skull',
  wing: 'Wing',
  cog: 'Cog',
  star: 'Star',
  fleur: 'Fleur',
};
