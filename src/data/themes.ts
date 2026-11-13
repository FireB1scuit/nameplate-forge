/**
 * Theme presets (plan.md §3.4). M1 ships Plain and Riveted; the rest arrive in M2.
 * A theme is data: outline + border + end-caps + material.
 */

export type ThemeId = 'plain' | 'riveted';

export interface ThemeMaterial {
  color: string;
  metalness: number;
  roughness: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  /** rounded uses design.plate.cornerRadius; rect has sharp corners */
  outline: 'rounded' | 'rect';
  /** raised inset border ring (flat-space offsets in mm) */
  border?: { inset: number; width: number };
  /** dome rivets at the plate ends */
  rivets?: { radius: number; inset: number };
  material: ThemeMaterial;
}

export const THEMES: Theme[] = [
  {
    id: 'plain',
    name: 'Plain',
    description: 'Rounded plate, nothing else. Cleanest print.',
    outline: 'rounded',
    material: { color: '#C9993F', metalness: 0.85, roughness: 0.32 },
  },
  {
    id: 'riveted',
    name: 'Riveted',
    description: 'Inset border and rivets. Looks bolted onto the rim.',
    outline: 'rect',
    border: { inset: 0.35, width: 0.3 },
    rivets: { radius: 0.42, inset: 1.05 },
    material: { color: '#9EA3AD', metalness: 0.8, roughness: 0.38 },
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
