/**
 * Surface textures (plan.md §3.4 layer 4): small downward displacements of the plate's top face,
 * applied per vertex during the warp. Inputs are flat layout coords in mm; output is a depth in mm
 * (≥ 0, pushed into the plate). Deterministic, so the same design always gives the same STL.
 */
import type { SurfaceType } from '../data/themes';
import { hash01 } from './outline';

const hash2 = (i: number, j: number) => hash01((i * 73856093) ^ (j * 19349663));

function valueNoise(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, oct = 3): number {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    s += amp * valueNoise(x * f, y * f);
    f *= 2;
    amp *= 0.5;
  }
  return s / (1 - Math.pow(0.5, oct));
}

/** Distance to the nearest jittered cell point (cell size 1). Optionally only some cells have one. */
function cellDist(x: number, y: number, keep = 1): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  let best = 9;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const ci = i + di;
      const cj = j + dj;
      if (keep < 1 && hash2(ci + 911, cj - 377) > keep) continue;
      const px = ci + 0.15 + 0.7 * hash2(ci, cj);
      const py = cj + 0.15 + 0.7 * hash2(cj + 5, ci - 3);
      best = Math.min(best, Math.hypot(x - px, y - py));
    }
  }
  return best;
}

/** Peak depth (mm) per surface type. */
export const SURFACE_DEPTH: Record<SurfaceType, number> = {
  smooth: 0,
  hammered: 0.08,
  wood: 0.07,
  stone: 0.08,
  rust: 0.1,
};

/** Depth (mm, ≥ 0) of the texture at flat point (x, y). */
export function surfaceDepth(type: SurfaceType, x: number, y: number): number {
  const A = SURFACE_DEPTH[type];
  switch (type) {
    case 'smooth':
      return 0;
    case 'hammered': {
      const s = 0.9;
      const d = cellDist(x / s, y / s);
      const t = Math.max(0, 1 - d / 0.62);
      return A * t * t;
    }
    case 'wood': {
      // grain runs along the plate (x); rings warped by low-frequency noise
      const warp = 0.9 * fbm(x * 0.12, y * 0.5, 2);
      const g = 0.5 + 0.5 * Math.sin(((y + warp) * 2 * Math.PI) / 0.42);
      return A * Math.pow(g, 3) * (0.6 + 0.4 * valueNoise(x * 0.8, y * 3));
    }
    case 'stone':
      return A * fbm(x / 0.9, y / 0.9, 3);
    case 'rust': {
      const s = 0.7;
      const d = cellDist(x / s, y / s, 0.4);
      const pit = Math.max(0, 1 - d / 0.45);
      return A * (0.25 * fbm(x * 2, y * 2, 2) + 0.75 * pit * pit);
    }
  }
}
