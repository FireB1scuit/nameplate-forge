/**
 * Plate outline generators (plan.md §5.3, §3.4 layer 1).
 *
 * Outlines are generated in the straight plate frame (u along the rim, v up the slant) around a
 * "core" rectangle that holds the text. Shapes with decorative ends (pointed, scroll, leaf, ...)
 * extend past the core by `outlineExtension()`, so text never runs into a tapering end. The
 * polygon is densified and bent into flat space with RimMap.bend. Borders are made later with
 * CrossSection offsets in flat space, which is exact because the flat layout is an isometry.
 */
import type { OutlineType } from '../data/themes';
import type { RimMap, Vec2 } from './conemap';

export interface PlateRect {
  /** half width of the core (text area + margins) along the rim, measured on the circle at refV */
  halfU: number;
  vBottom: number;
  vTop: number;
  /** slant height at which u is measured (normally the plate's middle) */
  refV: number;
}

/** How far the outline reaches past the core rectangle at each end (mm). */
export function outlineExtension(type: OutlineType, height: number): number {
  switch (type) {
    case 'pointed':
      return 0.55 * height;
    case 'scroll':
      return 0.5 * height;
    case 'leaf':
      return 1.0 * height;
    case 'jagged':
      return 0.3;
    case 'plank':
      return 0.3 * height;
    case 'monument':
      return 0.45 * height;
    default:
      return 0;
  }
}

/** Deterministic pseudo-random in [0, 1) from an integer. */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function arcPts(cu: number, cv: number, r: number, a0: number, a1: number, n: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
  }
  return out;
}

/**
 * Outline polygon in the straight frame (u, v), counter-clockwise, not yet densified.
 * `cornerRadius` is used by 'rounded'.
 */
export function outlinePolygon(type: OutlineType, r: PlateRect, cornerRadius = 0.6): Vec2[] {
  const { halfU: c, vBottom: vB, vTop: vT } = r;
  const h = vT - vB;
  const vM = (vB + vT) / 2;
  const e = outlineExtension(type, h);
  const U = c + e;
  const H = Math.PI / 2;

  switch (type) {
    case 'rect':
      return [
        [-U, vB],
        [U, vB],
        [U, vT],
        [-U, vT],
      ];
    case 'rounded': {
      const rr = Math.max(0, Math.min(cornerRadius, h / 2 - 0.05, U - 0.05));
      if (rr < 0.02) return outlinePolygon('rect', r);
      const n = 10;
      return [
        ...arcPts(U - rr, vB + rr, rr, -H, 0, n),
        ...arcPts(U - rr, vT - rr, rr, 0, H, n),
        ...arcPts(-U + rr, vT - rr, rr, H, 2 * H, n),
        ...arcPts(-U + rr, vB + rr, rr, 2 * H, 3 * H, n),
      ];
    }
    case 'chamfer': {
      const k = Math.min(0.9, h * 0.28, U * 0.4);
      return [
        [-U + k, vB],
        [U - k, vB],
        [U, vB + k],
        [U, vT - k],
        [U - k, vT],
        [-U + k, vT],
        [-U, vT - k],
        [-U, vB + k],
      ];
    }
    case 'pointed': {
      // gothic: the ends rise to a point on the centre line with slightly convex flanks
      const pts: Vec2[] = [];
      const n = 12;
      const flank = (s: number, top: boolean) => {
        const res: Vec2[] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n; // 0 at the shoulder, 1 at the tip
          const u = s * (c + e * t);
          const dv = (h / 2) * (1 - Math.pow(t, 1.35));
          res.push([u, top ? vM + dv : vM - dv]);
        }
        return res;
      };
      pts.push(...flank(1, false)); // bottom right shoulder -> tip
      pts.push(...flank(1, true).reverse().slice(1)); // tip -> top right shoulder
      pts.push(...flank(-1, true)); // top left shoulder -> tip
      pts.push(...flank(-1, false).reverse().slice(1));
      return pts;
    }
    case 'scroll': {
      // ribbon with swallowtail (forked) ends
      const notch = 0.55 * e;
      return [
        [-U, vB],
        [U, vB],
        [U - notch, vM],
        [U, vT],
        [-U, vT],
        [-U + notch, vM],
      ];
    }
    case 'leaf': {
      // blade: full height over the core, curved taper to a raised point at each end
      const n = 16;
      const top: Vec2[] = [];
      const bottom: Vec2[] = [];
      const taper = (x: number, p: number) => 1 - Math.pow(x, p);
      for (let i = 0; i <= n; i++) {
        const x = i / n;
        const lift = 0.22 * h * x * x;
        bottom.push([c + e * x, vM + lift - (h / 2) * taper(x, 1.4)]);
        top.push([c + e * x, vM + lift + (h / 2) * taper(x, 1.9)]);
      }
      const right = [...bottom, ...top.reverse().slice(1)];
      const left = right.map(([u, v]): Vec2 => [-u, v]).reverse();
      return [...right, ...left];
    }
    case 'jagged': {
      // torn sheet: every edge nibbled inwards by a deterministic random amount
      const amp = Math.min(0.35, h * 0.1);
      const pts: Vec2[] = [];
      const step = 0.55;
      let seed = 1;
      const nu = Math.max(2, Math.ceil((2 * U) / step));
      const nv = Math.max(2, Math.ceil(h / step));
      for (let i = 0; i < nu; i++) pts.push([-U + (2 * U * i) / nu, vB + amp * hash01(seed++)]);
      for (let i = 0; i < nv; i++) {
        const t = i / nv;
        pts.push([
          U - (0.2 + 0.8 * Math.abs(Math.sin(t * 7.1))) * 0.6 * hash01(seed++) * 1.3,
          vB + h * t,
        ]);
      }
      for (let i = 0; i < nu; i++) pts.push([U - (2 * U * i) / nu, vT - amp * hash01(seed++)]);
      for (let i = 0; i < nv; i++) pts.push([-U + 0.6 * 1.3 * hash01(seed++), vT - h * (i / nv)]);
      return pts;
    }
    case 'plank': {
      // rough-cut board: one end sawn at an angle, the other split
      return [
        [-U + e, vB],
        [U, vB],
        [U - 0.35 * e, vM - 0.1 * h],
        [U - 0.1 * e, vM + 0.12 * h],
        [U - 0.6 * e, vT],
        [-U, vT],
      ];
    }
    case 'monument': {
      // stepped plinth: wide foot, narrower body with clipped top corners
      const stepV = vB + 0.32 * h;
      const k = Math.min(0.5, 0.15 * h);
      return [
        [-U, vB],
        [U, vB],
        [U, stepV],
        [c, stepV],
        [c, vT - k],
        [c - k, vT],
        [-c + k, vT],
        [-c, vT - k],
        [-c, stepV],
        [-U, stepV],
      ];
    }
  }
}

/** Split long edges so the bend stays smooth, then bend into flat layout space. */
export function bendPolygon(map: RimMap, poly: Vec2[], refV: number, step = 0.25): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [u0, v0] = poly[i];
    const [u1, v1] = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push(map.bend(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, refV));
    }
  }
  return out;
}

/** Bent outline in flat space (convenience). */
export function plateOutline(
  map: RimMap,
  type: OutlineType,
  r: PlateRect,
  cornerRadius: number,
  step = 0.25,
): Vec2[] {
  return bendPolygon(map, outlinePolygon(type, r, cornerRadius), r.refV, step);
}

/** Back-compat helper: a bent rectangle. */
export function rectOutline(map: RimMap, r: PlateRect, step = 0.25): Vec2[] {
  return plateOutline(map, 'rect', r, 0, step);
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
