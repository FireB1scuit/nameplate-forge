/**
 * Design data model (plan.md §5.7), versioned with a migration chain.
 *
 * v1 (M1): round bases, line 1, raised text, Plain/Riveted theme id only.
 * v2 (M2–M5): all base shapes, line 2, text modes, thicken/align, style layers, blend/lip, fire arc.
 * v3: same fields, new defaults (40 mm riveted scroll plate). Share links only store fields that
 *     differ from the defaults, so links from v1/v2 are decoded against LEGACY_DEFAULTS.
 */
import { CUSTOM_PRESET_ID, findPreset, MDF_HEIGHT, type BaseShape } from '../data/bases';
import { DEFAULT_FONT_ID, findFont, isUserAsset } from '../data/fonts';
import {
  BORDERS,
  ENDCAP_ICONS,
  OUTLINES,
  SURFACES,
  THEME_IDS,
  getTheme,
  themeLayers,
  type BorderType,
  type OutlineType,
  type SurfaceType,
  type ThemeId,
} from '../data/themes';

export const DESIGN_VERSION = 3 as const;

export type EdgeType = 'sloped' | 'vertical';
export type TextMode = 'raised' | 'engraved' | 'cut';
export type WidthMode = 'auto' | 'mm' | 'deg';
export type Align = 'center' | 'left' | 'right';

export interface Design {
  v: typeof DESIGN_VERSION;
  base: {
    shape: BaseShape;
    /** preset id (e.g. 'r32') or 'custom' */
    presetId: string;
    /** bottom size [x, y] in mm (round: x == y) */
    bottom: [number, number];
    /** top size [x, y] in mm; ignored for a vertical edge */
    top: [number, number];
    /** rim height in mm */
    height: number;
    edge: EdgeType;
  };
  text: {
    line1: string;
    /** second line (rank / title); empty = none */
    line2: string;
    fontId: string;
    /** cap height of line 1 in mm */
    size1: number;
    /** cap height of line 2 in mm */
    size2: number;
    /** extra letter spacing in mm */
    spacing: number;
    uppercase: boolean;
    mode: TextMode;
    /** raised: height above the plate; engraved: depth into the plate (mm) */
    depth: number;
    /** stroke thicken: outward offset of the glyph outlines (mm) */
    thicken: number;
    /** horizontal alignment (matters when the plate is wider than the text) */
    align: Align;
    /** shrink the letters when the text does not fit the maximum plate width */
    autoShrink: boolean;
  };
  plate: {
    /** auto = text + padding + end-caps; mm = fixed width along the rim; deg = degrees of rim */
    width: { mode: WidthMode; value: number };
    /** largest plate in auto mode, in degrees of rim */
    maxDeg: number;
    /** plate height up the slant (mm) */
    height: number;
    thickness: number;
    /** space between text and plate ends (mm) */
    padding: number;
    cornerRadius: number;
    /** position around the base, 0° = front, positive = clockwise seen from above */
    angleDeg: number;
    /** shift up (+) / down (−) the slant from centred (mm) */
    offsetY: number;
    /** fit gap: back face offset from the rim (mm) */
    gap: number;
    /** blend into rim: plate spans the whole rim and its edges taper into the base surface */
    blend: boolean;
    /** top lip that hooks over the base's top edge */
    lip: { on: boolean; depth: number; thickness: number };
  };
  style: {
    themeId: ThemeId;
    outline: OutlineType;
    border: { type: BorderType; width: number; inset: number };
    endCaps: { icon: string; size: number; place: 'ends' | 'beside' };
    surface: SurfaceType;
  };
  extras: {
    /** fire-arc notches in the plate's top edge: 0 = off */
    fireArc: 0 | 90 | 180;
  };
}

export const DEFAULT_DESIGN: Design = {
  v: DESIGN_VERSION,
  base: {
    shape: 'round',
    presetId: 'r40',
    bottom: [40, 40],
    top: [36.6, 36.6],
    height: 4,
    edge: 'sloped',
  },
  text: {
    line1: 'Watch captain artemis',
    line2: '',
    fontId: DEFAULT_FONT_ID,
    size1: 2.8,
    size2: 1.8,
    spacing: 0.3,
    uppercase: true,
    mode: 'raised',
    depth: 0.5,
    thicken: 0.19,
    align: 'center',
    autoShrink: true,
  },
  plate: {
    width: { mode: 'mm', value: 45 },
    maxDeg: 140,
    height: 4.3,
    thickness: 0.8,
    padding: 1.0,
    cornerRadius: 0.6,
    angleDeg: 0,
    offsetY: 0,
    gap: 0.1,
    blend: false,
    lip: { on: false, depth: 1.2, thickness: 0.6 },
  },
  style: {
    themeId: 'riveted',
    outline: 'scroll',
    border: { type: 'single', width: 0.5, inset: 0.1 },
    endCaps: { icon: 'cog', size: 1.9, place: 'beside' },
    surface: 'hammered',
  },
  extras: { fireArc: 0 },
};

/** Defaults of design versions 1–2: old share links are diffs against these. */
export const LEGACY_DEFAULTS: Design = {
  ...structuredClone(DEFAULT_DESIGN),
  base: {
    shape: 'round',
    presetId: 'r32',
    bottom: [32, 32],
    top: [28.6, 28.6],
    height: 4,
    edge: 'sloped',
  },
  text: { ...DEFAULT_DESIGN.text, line1: 'BROTHER KAI', depth: 0.4, thicken: 0 },
  plate: {
    ...structuredClone(DEFAULT_DESIGN.plate),
    width: { mode: 'auto', value: 34 },
    height: 3.6,
  },
  style: { themeId: 'plain', ...themeLayers('plain') },
};

/** The defaults a stored diff of version `v` was made against. */
export function defaultsForVersion(v: unknown): Design {
  return typeof v === 'number' && v < 3 ? LEGACY_DEFAULTS : DEFAULT_DESIGN;
}

/** Slider ranges; also used to clamp untrusted input. */
export const LIMITS = {
  baseDiameter: [10, 300],
  baseHeight: [1, 15],
  size1: [1.5, 8],
  size2: [1.2, 6],
  spacing: [-0.5, 2],
  depth: [0.2, 1.5],
  thicken: [0, 0.3],
  widthMm: [5, 300],
  widthDeg: [5, 330],
  maxDeg: [30, 300],
  plateHeight: [2, 14],
  thickness: [0.4, 2.5],
  padding: [0, 6],
  cornerRadius: [0, 3],
  angleDeg: [-180, 180],
  offsetY: [-6, 6],
  gap: [0, 0.5],
  borderWidth: [0.2, 1],
  borderInset: [0.1, 1.5],
  iconSize: [0.5, 8],
  lipDepth: [0.4, 4],
  lipThickness: [0.3, 1.5],
} as const satisfies Record<string, readonly [number, number]>;

export const MAX_TEXT_LENGTH = 60;

export interface ResolvedBase {
  shape: BaseShape;
  bottom: [number, number];
  top: [number, number];
  H: number;
}

/** Effective base dimensions (mm, full sizes), honouring the edge type. */
export function resolveBase(base: Design['base']): ResolvedBase {
  const bottom: [number, number] =
    base.shape === 'round' || base.shape === 'square'
      ? [base.bottom[0], base.bottom[0]]
      : [base.bottom[0], base.bottom[1]];
  if (base.edge === 'vertical') {
    const preset = findPreset(base.presetId);
    return { shape: base.shape, bottom, top: [...bottom], H: preset ? MDF_HEIGHT : base.height };
  }
  const topRaw =
    base.shape === 'round' || base.shape === 'square' ? [base.top[0], base.top[0]] : base.top;
  const top: [number, number] = [Math.min(topRaw[0], bottom[0]), Math.min(topRaw[1], bottom[1])];
  return { shape: base.shape, bottom, top, H: base.height };
}

/** Round-base rim radii (mm). For other shapes: x-axis radii (used for camera framing). */
export function resolveFrustum(base: Design['base']): { Rb: number; Rt: number; H: number } {
  const r = resolveBase(base);
  return { Rb: r.bottom[0] / 2, Rt: r.top[0] / 2, H: r.H };
}

/** Largest horizontal radius of the base (mm), for framing and shadows. */
export function baseExtent(base: Design['base']): number {
  const r = resolveBase(base);
  const half = Math.max(r.bottom[0], r.bottom[1]) / 2;
  return r.shape === 'square' || r.shape === 'rect'
    ? Math.hypot(r.bottom[0], r.bottom[1]) / 2
    : half;
}

// ---------------------------------------------------------------------------------------------
// Sanitising + migrations (used for share links and anything else untrusted)
// ---------------------------------------------------------------------------------------------

type Migration = (d: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades a design from version n to n + 1. */
export const migrations: Record<number, Migration> = {
  // v1 stored only style.themeId; the layers come from that theme
  1: (d) => {
    const style = isObj(d.style) ? d.style : {};
    const themeId = typeof style.themeId === 'string' ? style.themeId : 'plain';
    return { ...d, style: { themeId, ...themeLayers(themeId) } };
  },
  // v2 -> v3 changed only the defaults; decodeDesign merges old links onto LEGACY_DEFAULTS
  2: (d) => d,
};

export function migrate(input: Record<string, unknown>): Record<string, unknown> {
  let d = input;
  let v = typeof d.v === 'number' ? d.v : DESIGN_VERSION;
  while (v < DESIGN_VERSION) {
    const m = migrations[v];
    if (!m) break;
    d = m(d);
    v += 1;
  }
  return { ...d, v: DESIGN_VERSION };
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function num(x: unknown, fallback: number, [lo, hi]: readonly [number, number]): number {
  const n = typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  return Math.min(hi, Math.max(lo, n));
}
function bool(x: unknown, fallback: boolean): boolean {
  return typeof x === 'boolean' ? x : fallback;
}
function oneOf<T extends string | number>(x: unknown, options: readonly T[], fallback: T): T {
  return options.includes(x as T) ? (x as T) : fallback;
}
function pair(
  x: unknown,
  fallback: [number, number],
  lim: readonly [number, number],
): [number, number] {
  if (!Array.isArray(x)) return [...fallback];
  const a = num(x[0], fallback[0], lim);
  return [a, num(x[1], a, lim)];
}
function cleanText(x: unknown, fallback: string): string {
  return (
    (typeof x === 'string' ? x : fallback)
      // strip control characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, MAX_TEXT_LENGTH)
  );
}

/** Asset ids (fonts/SVGs) that this session knows about; others fall back to defaults. */
export interface AssetCheck {
  hasIcon(id: string): boolean;
}
const noUserIcons: AssetCheck = { hasIcon: () => false };

/**
 * Deep-merge an untrusted partial design onto the defaults, coercing types and clamping ranges.
 * Always returns a complete, valid Design.
 */
export function sanitizeDesign(input: unknown, assets: AssetCheck = noUserIcons): Design {
  const D = DEFAULT_DESIGN;
  const raw = isObj(input) ? migrate(input) : {};
  const b = isObj(raw.base) ? raw.base : {};
  const t = isObj(raw.text) ? raw.text : {};
  const p = isObj(raw.plate) ? raw.plate : {};
  const s = isObj(raw.style) ? raw.style : {};
  const x = isObj(raw.extras) ? raw.extras : {};
  const pw = isObj(p.width) ? p.width : {};
  const lip = isObj(p.lip) ? p.lip : {};
  const sb = isObj(s.border) ? s.border : {};
  const se = isObj(s.endCaps) ? s.endCaps : {};

  const shape = oneOf(b.shape, ['round', 'oval', 'square', 'rect'] as const, D.base.shape);
  const preset = typeof b.presetId === 'string' ? findPreset(b.presetId) : undefined;
  const presetId =
    b.presetId === CUSTOM_PRESET_ID
      ? CUSTOM_PRESET_ID
      : preset && preset.shape === shape
        ? preset.id
        : shape === D.base.shape
          ? D.base.presetId
          : CUSTOM_PRESET_ID;
  const bottom = pair(b.bottom, D.base.bottom, LIMITS.baseDiameter);
  const topRaw = pair(b.top, D.base.top, LIMITS.baseDiameter);
  const top: [number, number] = [Math.min(topRaw[0], bottom[0]), Math.min(topRaw[1], bottom[1])];

  const fontId = typeof t.fontId === 'string' && findFont(t.fontId) ? t.fontId : D.text.fontId;
  const iconRaw = typeof se.icon === 'string' ? se.icon : D.style.endCaps.icon;
  const icon =
    (ENDCAP_ICONS as readonly string[]).includes(iconRaw) ||
    (isUserAsset(iconRaw) && assets.hasIcon(iconRaw))
      ? iconRaw
      : 'none';
  const wmode = oneOf(pw.mode, ['auto', 'mm', 'deg'] as const, D.plate.width.mode);

  return {
    v: DESIGN_VERSION,
    base: {
      shape,
      presetId,
      bottom,
      top,
      height: num(b.height, D.base.height, LIMITS.baseHeight),
      edge: oneOf(b.edge, ['sloped', 'vertical'] as const, D.base.edge),
    },
    text: {
      line1: cleanText(t.line1, D.text.line1),
      line2: cleanText(t.line2, D.text.line2),
      fontId,
      size1: num(t.size1, D.text.size1, LIMITS.size1),
      size2: num(t.size2, D.text.size2, LIMITS.size2),
      spacing: num(t.spacing, D.text.spacing, LIMITS.spacing),
      uppercase: bool(t.uppercase, D.text.uppercase),
      mode: oneOf(t.mode, ['raised', 'engraved', 'cut'] as const, D.text.mode),
      depth: num(t.depth, D.text.depth, LIMITS.depth),
      thicken: num(t.thicken, D.text.thicken, LIMITS.thicken),
      align: oneOf(t.align, ['center', 'left', 'right'] as const, D.text.align),
      autoShrink: bool(t.autoShrink, D.text.autoShrink),
    },
    plate: {
      width: {
        mode: wmode,
        value: num(
          pw.value,
          D.plate.width.value,
          wmode === 'deg' ? LIMITS.widthDeg : LIMITS.widthMm,
        ),
      },
      maxDeg: num(p.maxDeg, D.plate.maxDeg, LIMITS.maxDeg),
      height: num(p.height, D.plate.height, LIMITS.plateHeight),
      thickness: num(p.thickness, D.plate.thickness, LIMITS.thickness),
      padding: num(p.padding, D.plate.padding, LIMITS.padding),
      cornerRadius: num(p.cornerRadius, D.plate.cornerRadius, LIMITS.cornerRadius),
      angleDeg: num(p.angleDeg, D.plate.angleDeg, LIMITS.angleDeg),
      offsetY: num(p.offsetY, D.plate.offsetY, LIMITS.offsetY),
      gap: num(p.gap, D.plate.gap, LIMITS.gap),
      blend: bool(p.blend, D.plate.blend),
      lip: {
        on: bool(lip.on, D.plate.lip.on),
        depth: num(lip.depth, D.plate.lip.depth, LIMITS.lipDepth),
        thickness: num(lip.thickness, D.plate.lip.thickness, LIMITS.lipThickness),
      },
    },
    style: {
      themeId: oneOf(s.themeId, THEME_IDS, D.style.themeId),
      outline: oneOf(s.outline, OUTLINES, D.style.outline),
      border: {
        type: oneOf(sb.type, BORDERS, D.style.border.type),
        width: num(sb.width, D.style.border.width, LIMITS.borderWidth),
        inset: num(sb.inset, D.style.border.inset, LIMITS.borderInset),
      },
      endCaps: {
        icon,
        size: num(se.size, D.style.endCaps.size, LIMITS.iconSize),
        place: oneOf(se.place, ['ends', 'beside'] as const, D.style.endCaps.place),
      },
      surface: oneOf(s.surface, SURFACES, D.style.surface),
    },
    extras: { fireArc: oneOf(x.fireArc, [0, 90, 180] as const, D.extras.fireArc) },
  };
}

/** Does the design reference uploaded assets that a share link can't carry? */
export function usesUserAssets(d: Design): boolean {
  return isUserAsset(d.text.fontId) || isUserAsset(d.style.endCaps.icon);
}

/** Apply a theme preset: its style layers and font (the user can change any of them after). */
export function applyTheme(d: Design, id: ThemeId): void {
  const theme = getTheme(id);
  d.style = { themeId: theme.id, ...themeLayers(theme.id) };
  d.text.fontId = theme.fontId;
  if (theme.plateHeight) {
    // taller for the border, but not past the rim's slope (it would stick up above the base)
    const r = resolveBase(d.base);
    const slant = Math.hypot((r.bottom[0] - r.top[0]) / 2, r.H);
    d.plate.height = Math.max(
      d.plate.height,
      Math.min(theme.plateHeight, Math.floor(slant * 10) / 10),
    );
  }
}
