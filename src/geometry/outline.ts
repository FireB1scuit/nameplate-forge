/**
 * Plate outline generators (plan.md §5.3, §3.4 layer 1).
 *
 * Outlines are generated in the straight plate frame (u along the rim, v up the slant), densely
 * sampled, and bent into the flat layout with RimMap.bend. Rounded corners and inset borders are
 * done afterwards with CrossSection offsets in flat space, which is exact because the flat layout
 * is an isometry of the rim surface.
 */
import type { RimMap, Vec2 } from './conemap';

export interface PlateRect {
  /** half width along the rim, measured on the circle at refV (mm) */
  halfU: number;
  vBottom: number;
  vTop: number;
  /** slant height at which u is measured (normally the plate's middle) */
  refV: number;
}

/** Sample count for a segment so no edge is longer than `step`. */
function steps(len: number, step: number): number {
  return Math.max(1, Math.ceil(Math.abs(len) / step));
}

/**
 * Rectangle in the straight frame, bent into flat space. Counter-clockwise.
 * `step` limits edge length so the bend stays smooth.
 */
export function rectOutline(map: RimMap, r: PlateRect, step = 0.25): Vec2[] {
  const { halfU, vBottom, vTop, refV } = r;
  const pts: Vec2[] = [];
  const nu = steps(2 * halfU, step);
  const nv = steps(vTop - vBottom, step);
  // bottom: left -> right
  for (let i = 0; i < nu; i++) pts.push(map.bend(-halfU + (2 * halfU * i) / nu, vBottom, refV));
  // right: bottom -> top
  for (let i = 0; i < nv; i++)
    pts.push(map.bend(halfU, vBottom + ((vTop - vBottom) * i) / nv, refV));
  // top: right -> left
  for (let i = 0; i < nu; i++) pts.push(map.bend(halfU - (2 * halfU * i) / nu, vTop, refV));
  // left: top -> bottom
  for (let i = 0; i < nv; i++) pts.push(map.bend(-halfU, vTop - ((vTop - vBottom) * i) / nv, refV));
  return pts;
}

/** Signed area (positive = counter-clockwise). */
export function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]);
  }
  return a / 2;
}

/** Rivet centres in the straight frame (u, v), mirrored at both plate ends. */
export function rivetCentres(
  r: PlateRect,
  rivet: { radius: number; inset: number },
): Array<[number, number]> {
  const h = r.vTop - r.vBottom;
  const vMid = (r.vBottom + r.vTop) / 2;
  const u = r.halfU - rivet.inset;
  // two rivets per end when the plate is tall enough, otherwise one, centred
  const dv = h / 2 - rivet.inset;
  const rows = dv > rivet.radius * 1.6 ? [vMid - dv, vMid + dv] : [vMid];
  const out: Array<[number, number]> = [];
  for (const v of rows) out.push([-u, v], [u, v]);
  return out;
}
