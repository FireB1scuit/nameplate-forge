/**
 * Base presets (plan.md §6).
 *
 * TODO(measure): top diameters and heights are NOT measured yet. They use the placeholder rule
 * from plan.md §6: top = bottom − 3.4 mm, height = 4.0 mm (≤ 60 mm) / 5.0 mm (> 60 mm).
 * Replace with caliper measurements of real bases before release (milestone M3).
 */

export interface BasePreset {
  id: string;
  shape: 'round';
  label: string;
  /** bottom diameter (mm) */
  bottom: number;
  /** top diameter (mm) — PLACEHOLDER until measured */
  top: number;
  /** rim height (mm) — PLACEHOLDER until measured */
  height: number;
  /** true while the dimensions come from the placeholder rule */
  unmeasured: boolean;
}

/** Placeholder rule from plan.md §6. */
export function placeholderDims(bottom: number): { top: number; height: number } {
  return { top: round2(bottom - 3.4), height: bottom <= 60 ? 4.0 : 5.0 };
}

/** Typical MDF base thickness (mm), used when switching a preset to a flat MDF edge. */
export const MDF_HEIGHT = 3.0;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

const ROUND_BOTTOMS: Array<[string, number]> = [
  ['r25', 25],
  ['r28', 28.5],
  ['r32', 32],
  ['r40', 40],
  ['r50', 50],
  ['r60', 60],
  ['r80', 80],
  ['r90', 90],
  ['r100', 100],
  ['r130', 130],
  ['r160', 160],
];

export const ROUND_PRESETS: BasePreset[] = ROUND_BOTTOMS.map(([id, bottom]) => ({
  id,
  shape: 'round',
  label: String(bottom),
  bottom,
  ...placeholderDims(bottom),
  unmeasured: true,
}));

export const CUSTOM_PRESET_ID = 'custom';

export function findPreset(id: string): BasePreset | undefined {
  return ROUND_PRESETS.find((p) => p.id === id);
}
