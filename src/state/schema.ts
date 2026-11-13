/**
 * Design data model (plan.md §5.7), versioned with a migration chain.
 *
 * M1 implements a subset of the sketch: round bases, line 1, raised text, Plain/Riveted themes.
 * Fields for later milestones are only added when they are implemented, so share links stay short
 * and every stored field means something.
 */
import { CUSTOM_PRESET_ID, findPreset, MDF_HEIGHT } from '../data/bases';
import { DEFAULT_FONT_ID, findFont } from '../data/fonts';
import type { ThemeId } from '../data/themes';

export const DESIGN_VERSION = 1 as const;

export type EdgeType = 'sloped' | 'vertical';
export type TextMode = 'raised';
export type WidthMode = 'auto' | 'mm';

export interface Design {
  v: typeof DESIGN_VERSION;
  base: {
    shape: 'round';
    /** preset id (e.g. 'r32') or 'custom' */
    presetId: string;
    /** bottom diameter [x, y] in mm (round: x == y) */
    bottom: [number, number];
    /** top diameter [x, y] in mm (round: x == y); ignored for a vertical edge */
    top: [number, number];
    /** rim height in mm */
    height: number;
    edge: EdgeType;
  };
  text: {
    line1: string;
    fontId: string;
    /** cap height of line 1 in mm */
    size1: number;
    /** extra letter spacing in mm */
    spacing: number;
    uppercase: boolean;
    mode: TextMode;
    /** height of raised text above the plate (mm) */
    depth: number;
    /** shrink the letters when the text does not fit the maximum plate width */
    autoShrink: boolean;
  };
  plate: {
    /** auto = text + padding (+ end-caps); mm = fixed width along the rim */
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
  };
  style: { themeId: ThemeId };
}

export const DEFAULT_DESIGN: Design = {
  v: DESIGN_VERSION,
  base: {
    shape: 'round',
    presetId: 'r32',
    bottom: [32, 32],
    top: [28.6, 28.6],
    height: 4,
    edge: 'sloped',
  },
  text: {
    line1: 'BROTHER KAI',
    fontId: DEFAULT_FONT_ID,
    size1: 2.8,
    spacing: 0.3,
    uppercase: true,
    mode: 'raised',
    depth: 0.4,
    autoShrink: true,
  },
  plate: {
    width: { mode: 'auto', value: 34 },
    maxDeg: 140,
    height: 3.6,
    thickness: 0.8,
    padding: 1.0,
    cornerRadius: 0.6,
    angleDeg: 0,
    offsetY: 0,
    gap: 0.1,
  },
  style: { themeId: 'plain' },
};

/** Slider ranges; also used to clamp untrusted input. */
export const LIMITS = {
  baseDiameter: [10, 300],
  baseHeight: [1, 15],
  size1: [1.5, 8],
  spacing: [-0.5, 2],
  depth: [0.2, 1.5],
  widthMm: [5, 300],
  maxDeg: [30, 300],
  plateHeight: [2, 12],
  thickness: [0.4, 2.5],
  padding: [0, 6],
  cornerRadius: [0, 3],
  angleDeg: [-180, 180],
  offsetY: [-6, 6],
  gap: [0, 0.5],
} as const satisfies Record<string, readonly [number, number]>;

export const MAX_TEXT_LENGTH = 60;

/** Effective rim dimensions in mm (radii), honouring the edge type. */
export function resolveFrustum(base: Design['base']): { Rb: number; Rt: number; H: number } {
  const Rb = base.bottom[0] / 2;
  if (base.edge === 'vertical') {
    const preset = findPreset(base.presetId);
    return { Rb, Rt: Rb, H: preset ? MDF_HEIGHT : base.height };
  }
  return { Rb, Rt: Math.min(base.top[0] / 2, Rb), H: base.height };
}

// ---------------------------------------------------------------------------------------------
// Sanitising + migrations (used for share links and anything else untrusted)
// ---------------------------------------------------------------------------------------------

type Migration = (d: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades a design from version n to n + 1. */
export const migrations: Record<number, Migration> = {};

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
function oneOf<T extends string>(x: unknown, options: readonly T[], fallback: T): T {
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

/**
 * Deep-merge an untrusted partial design onto the defaults, coercing types and clamping ranges.
 * Always returns a complete, valid Design.
 */
export function sanitizeDesign(input: unknown): Design {
  const D = DEFAULT_DESIGN;
  const raw = isObj(input) ? migrate(input) : {};
  const b = isObj(raw.base) ? raw.base : {};
  const t = isObj(raw.text) ? raw.text : {};
  const p = isObj(raw.plate) ? raw.plate : {};
  const s = isObj(raw.style) ? raw.style : {};
  const pw = isObj(p.width) ? p.width : {};

  const presetId =
    typeof b.presetId === 'string' && (b.presetId === CUSTOM_PRESET_ID || findPreset(b.presetId))
      ? b.presetId
      : D.base.presetId;
  const bottom = pair(b.bottom, D.base.bottom, LIMITS.baseDiameter);
  const topRaw = pair(b.top, D.base.top, LIMITS.baseDiameter);
  const top: [number, number] = [Math.min(topRaw[0], bottom[0]), Math.min(topRaw[1], bottom[1])];

  const line1 = (typeof t.line1 === 'string' ? t.line1 : D.text.line1)
    // strip control characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, MAX_TEXT_LENGTH);

  return {
    v: DESIGN_VERSION,
    base: {
      shape: 'round',
      presetId,
      bottom,
      top,
      height: num(b.height, D.base.height, LIMITS.baseHeight),
      edge: oneOf(b.edge, ['sloped', 'vertical'] as const, D.base.edge),
    },
    text: {
      line1,
      fontId: typeof t.fontId === 'string' && findFont(t.fontId) ? t.fontId : D.text.fontId,
      size1: num(t.size1, D.text.size1, LIMITS.size1),
      spacing: num(t.spacing, D.text.spacing, LIMITS.spacing),
      uppercase: bool(t.uppercase, D.text.uppercase),
      mode: 'raised',
      depth: num(t.depth, D.text.depth, LIMITS.depth),
      autoShrink: bool(t.autoShrink, D.text.autoShrink),
    },
    plate: {
      width: {
        mode: oneOf(pw.mode, ['auto', 'mm'] as const, D.plate.width.mode),
        value: num(pw.value, D.plate.width.value, LIMITS.widthMm),
      },
      maxDeg: num(p.maxDeg, D.plate.maxDeg, LIMITS.maxDeg),
      height: num(p.height, D.plate.height, LIMITS.plateHeight),
      thickness: num(p.thickness, D.plate.thickness, LIMITS.thickness),
      padding: num(p.padding, D.plate.padding, LIMITS.padding),
      cornerRadius: num(p.cornerRadius, D.plate.cornerRadius, LIMITS.cornerRadius),
      angleDeg: num(p.angleDeg, D.plate.angleDeg, LIMITS.angleDeg),
      offsetY: num(p.offsetY, D.plate.offsetY, LIMITS.offsetY),
      gap: num(p.gap, D.plate.gap, LIMITS.gap),
    },
    style: { themeId: oneOf(s.themeId, ['plain', 'riveted'] as const, D.style.themeId) },
  };
}
