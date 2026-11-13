/**
 * Base presets (plan.md §6).
 *
 * TODO(measure): top sizes and heights are NOT caliper-measured yet. They use the placeholder rule
 * from plan.md §6: top = bottom − 3.4 mm (per axis), height = 4.0 mm (≤ 60 mm) / 5.0 mm (> 60 mm).
 * Users can correct any preset with Custom; the UI says these are estimates.
 */

export type BaseShape = 'round' | 'oval' | 'square' | 'rect';

export interface BasePreset {
  id: string;
  shape: BaseShape;
  label: string;
  /** bottom size [x, y] (mm); round: x == y */
  bottom: [number, number];
  /** top size [x, y] (mm) — PLACEHOLDER until measured */
  top: [number, number];
  /** rim height (mm) — PLACEHOLDER until measured */
  height: number;
  /** true while the dimensions come from the placeholder rule */
  unmeasured: boolean;
}

const INSET = 3.4;

/** Placeholder rule from plan.md §6 (largest side decides the height). */
export function placeholderDims(bottom: [number, number]): {
  top: [number, number];
  height: number;
} {
  return {
    top: [round2(bottom[0] - INSET), round2(bottom[1] - INSET)],
    height: Math.max(bottom[0], bottom[1]) <= 60 ? 4.0 : 5.0,
  };
}

/** Typical MDF base thickness (mm), used when switching a preset to a flat MDF edge. */
export const MDF_HEIGHT = 3.0;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function make(id: string, shape: BaseShape, x: number, y = x, label?: string): BasePreset {
  const bottom: [number, number] = [x, y];
  return {
    id,
    shape,
    label: label ?? (x === y ? String(x) : `${x}×${y}`),
    bottom,
    ...placeholderDims(bottom),
    unmeasured: true,
  };
}

export const ROUND_PRESETS: BasePreset[] = [
  make('r25', 'round', 25),
  make('r28', 'round', 28.5),
  make('r32', 'round', 32),
  make('r40', 'round', 40),
  make('r50', 'round', 50),
  make('r60', 'round', 60),
  make('r80', 'round', 80),
  make('r90', 'round', 90),
  make('r100', 'round', 100),
  make('r130', 'round', 130),
  make('r160', 'round', 160),
];

export const OVAL_PRESETS: BasePreset[] = [
  make('o60x35', 'oval', 60, 35),
  make('o75x42', 'oval', 75, 42),
  make('o90x52', 'oval', 90, 52),
  make('o105x70', 'oval', 105, 70),
  make('o120x92', 'oval', 120, 92),
  make('o150x95', 'oval', 150, 95),
  make('o170x105', 'oval', 170, 105),
];

export const SQUARE_PRESETS: BasePreset[] = [
  make('s20', 'square', 20),
  make('s25', 'square', 25),
  make('q25x50', 'rect', 50, 25, '25×50'),
  make('q50x100', 'rect', 100, 50, '50×100'),
];

export const ALL_PRESETS: BasePreset[] = [...ROUND_PRESETS, ...OVAL_PRESETS, ...SQUARE_PRESETS];

export const CUSTOM_PRESET_ID = 'custom';

export function findPreset(id: string): BasePreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}

export function presetsFor(shape: BaseShape): BasePreset[] {
  if (shape === 'round') return ROUND_PRESETS;
  if (shape === 'oval') return OVAL_PRESETS;
  return SQUARE_PRESETS;
}
