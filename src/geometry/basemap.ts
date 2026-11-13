/**
 * Picks the rim map for a base shape and builds the base as a solid (for "plate + base" export).
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d';
import type { ResolvedBase } from '../state/schema';
import { createRimMap, type RimMap, type Vec3 } from './conemap';
import { createOvalMap, createPlaneMap } from './surfacemaps';

export function createBaseMap(base: ResolvedBase, angleDeg: number): RimMap {
  switch (base.shape) {
    case 'round':
      return createRimMap(
        { Rb: base.bottom[0] / 2, Rt: Math.min(base.top[0], base.bottom[0]) / 2, H: base.H },
        angleDeg,
      );
    case 'oval':
      if (
        Math.abs(base.bottom[0] - base.bottom[1]) < 1e-6 &&
        Math.abs(base.top[0] - base.top[1]) < 1e-6
      ) {
        return createBaseMap({ ...base, shape: 'round' }, angleDeg);
      }
      return createOvalMap({ bottom: base.bottom, top: base.top, H: base.H }, angleDeg);
    case 'square':
    case 'rect':
      return createPlaneMap({ bottom: base.bottom, top: base.top, H: base.H }, angleDeg);
  }
}

/** Outline ring of the base at height fraction f (0 = bottom, 1 = top), world XY (mm). */
export function baseRing(base: ResolvedBase, f: number, segments = 96): Array<[number, number]> {
  const sx = (base.bottom[0] + (base.top[0] - base.bottom[0]) * f) / 2;
  const sy = (base.bottom[1] + (base.top[1] - base.bottom[1]) * f) / 2;
  if (base.shape === 'square' || base.shape === 'rect') {
    return [
      [-sx, -sy],
      [sx, -sy],
      [sx, sy],
      [-sx, sy],
    ];
  }
  return Array.from({ length: segments }, (_, i) => {
    const a = (2 * Math.PI * i) / segments;
    return [sx * Math.cos(a), sy * Math.sin(a)];
  });
}

/** The base as a convex solid (hull of the bottom and top rings). */
export function baseSolid(wasm: ManifoldToplevel, base: ResolvedBase): Manifold {
  const pts: Vec3[] = [
    ...baseRing(base, 0, 128).map(([x, y]): Vec3 => [x, y, 0]),
    ...baseRing(base, 1, 128).map(([x, y]): Vec3 => [x, y, base.H]),
  ];
  return wasm.Manifold.hull(pts);
}
