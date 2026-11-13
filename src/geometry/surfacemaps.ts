/**
 * Rim maps for non-round bases (plan.md §5.4).
 *
 *  - Oval (approximate): the rim of an oval base is a frustum of an elliptic cone, which can't be
 *    unrolled exactly. The layout is a plain rectangle: X = arc length along the rim at the point's
 *    own height, Y = distance up the slant. X is converted to the ellipse parameter with an
 *    arc-length lookup table built on the mid-height ellipse. Distances along the rim and up the
 *    slant are preserved; the only error is a small shear where the curvature changes quickly
 *    (the tight ends of the oval). Build warns when a plate covers a lot of the perimeter.
 *  - Plane (square / rectangular bases): the plate sits on one flat (possibly sloped) face, so the
 *    map is a rotation plus a tilt with no bending. The face is picked from the placement angle
 *    (snapped to 0°, 90°, 180° or −90°).
 *
 * Same conventions as conemap.ts: world Z-up, azimuth 0 = front = −Y, positive towards +X.
 */
import type { Frame2, RimMap, Vec2, Vec3 } from './conemap';

export interface BoxDims {
  /** bottom size [x, y] (mm, full diameters / widths) */
  bottom: [number, number];
  /** top size [x, y] (mm) */
  top: [number, number];
  /** rim height (mm) */
  H: number;
}

const TWO_PI = Math.PI * 2;

/** Ramanujan's approximation of an ellipse perimeter. */
export function ellipsePerimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export function createOvalMap(dims: BoxDims, angleDeg = 0): RimMap {
  const ab = dims.bottom[0] / 2;
  const bb = dims.bottom[1] / 2;
  const at = Math.min(dims.top[0], dims.bottom[0]) / 2;
  const bt = Math.min(dims.top[1], dims.bottom[1]) / 2;
  const H = dims.H;
  if (!(ab > 0 && bb > 0 && at > 0 && bt > 0 && H > 0)) throw new Error('Invalid oval base');
  const t0 = (angleDeg * Math.PI) / 180;

  const axes = (f: number): [number, number] => [ab + (at - ab) * f, bb + (bt - bb) * f];
  const perim = (f: number) => ellipsePerimeter(...axes(f));
  const Pmid = perim(0.5);
  const slantAt = (t: number) => Math.hypot((at - ab) * Math.sin(t), (bt - bb) * Math.cos(t), H);
  const slant = slantAt(t0);

  // arc-length LUT on the mid ellipse, from t0 − π to t0 + π, with s(t0) = 0
  const N = 4096;
  const [am, bm] = axes(0.5);
  const ts = new Float64Array(N + 1);
  const ss = new Float64Array(N + 1);
  let acc = 0;
  for (let k = 0; k <= N; k++) {
    const t = t0 - Math.PI + (TWO_PI * k) / N;
    ts[k] = t;
    if (k > 0) {
      const tm = t - Math.PI / N;
      acc += Math.hypot(am * Math.cos(tm), bm * Math.sin(tm)) * (TWO_PI / N);
    }
    ss[k] = acc;
  }
  const sMid = ss[N / 2];
  for (let k = 0; k <= N; k++) ss[k] -= sMid;
  const lutTotal = ss[N] - ss[0];

  /** mid-ellipse arc length (from t0) -> ellipse parameter */
  const tFromArc = (s: number): number => {
    // wrap into the table range
    let x = s;
    while (x < ss[0]) x += lutTotal;
    while (x > ss[N]) x -= lutTotal;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ss[mid] <= x) lo = mid;
      else hi = mid;
    }
    const f = (x - ss[lo]) / (ss[hi] - ss[lo] || 1);
    return ts[lo] + (ts[hi] - ts[lo]) * f;
  };
  const arcFromT = (t: number): number => {
    let tt = t;
    while (tt < ts[0]) tt += TWO_PI;
    while (tt > ts[N]) tt -= TWO_PI;
    const k = Math.min(N - 1, Math.max(0, Math.floor(((tt - ts[0]) / TWO_PI) * N)));
    const f = (tt - ts[k]) / (ts[k + 1] - ts[k]);
    return ss[k] + (ss[k + 1] - ss[k]) * f;
  };

  const point = (t: number, f: number): Vec3 => {
    const [a, b] = axes(f);
    return [a * Math.sin(t), -b * Math.cos(t), H * f];
  };
  const normal = (t: number, f: number): Vec3 => {
    const [a, b] = axes(f);
    const tx = a * Math.cos(t);
    const ty = b * Math.sin(t);
    const sx = (at - ab) * Math.sin(t);
    const sy = -(bt - bb) * Math.cos(t);
    const sz = H;
    // tangent × slant direction (points outwards)
    const nx = ty * sz;
    const ny = -tx * sz;
    const nz = tx * sy - ty * sx;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  };
  const fOf = (v: number) => v / slant;
  const tOf = (X: number, f: number) => tFromArc((X * Pmid) / perim(f));

  return {
    kind: 'oval',
    frustum: { Rb: Pmid / TWO_PI, Rt: Pmid / TWO_PI, H },
    slant,
    angle: t0,
    radiusAt: (v) => perim(fOf(v)) / TWO_PI,
    arcForDeg: (deg, v) => (deg / 360) * perim(fOf(v)),
    arcToDeg: (arc, v) => (arc / perim(fOf(v))) * 360,
    maxArc: (v) => 0.9 * perim(fOf(v)),
    unbend: (X, Y) => [X, Y],
    bend: (u, v) => [u, v],
    frameAt: (arc, v): Frame2 => ({ x: arc, y: v, rot: 0 }),
    scaleArc: (arc) => arc,
    toWorld(X, Y, w) {
      const f = fOf(Y);
      const t = tOf(X, f);
      const p = point(t, f);
      const n = normal(t, f);
      return [p[0] + w * n[0], p[1] + w * n[1], p[2] + w * n[2]];
    },
    toFlat(P) {
      // find the ellipse parameter whose slant line passes closest to P (tangential residual = 0)
      const resid = (t: number) => {
        const B = point(t, 0);
        const T = point(t, 1);
        const d: Vec3 = [T[0] - B[0], T[1] - B[1], T[2] - B[2]];
        const L = Math.hypot(...d);
        const u: Vec3 = [d[0] / L, d[1] / L, d[2] / L];
        const r: Vec3 = [P[0] - B[0], P[1] - B[1], P[2] - B[2]];
        const along = r[0] * u[0] + r[1] * u[1] + r[2] * u[2];
        const ft = Math.min(1, Math.max(0, along / L));
        const [a, b] = axes(ft);
        const tan = [a * Math.cos(t), b * Math.sin(t)];
        const tl = Math.hypot(tan[0], tan[1]);
        const perp: Vec3 = [r[0] - along * u[0], r[1] - along * u[1], r[2] - along * u[2]];
        return { g: (perp[0] * tan[0] + perp[1] * tan[1]) / tl, along, L };
      };
      let t = Math.atan2(P[0] / am, -P[1] / bm);
      for (let i = 0; i < 30; i++) {
        const h = 1e-6;
        const g = resid(t).g;
        const dg = (resid(t + h).g - resid(t - h).g) / (2 * h);
        if (Math.abs(dg) < 1e-12) break;
        const step = g / dg;
        t -= step;
        if (Math.abs(step) < 1e-13) break;
      }
      const { along, L } = resid(t);
      const f = along / L;
      const v = f * slant;
      const p = point(t, f);
      const n = normal(t, f);
      const w = (P[0] - p[0]) * n[0] + (P[1] - p[1]) * n[1] + (P[2] - p[2]) * n[2];
      const X = (arcFromT(t) * perim(f)) / Pmid;
      return [X, v, w];
    },
    normalAt(theta) {
      return normal(t0 + theta, 0.5);
    },
  };
}

/** Which face of a square/rect base a placement angle lands on (0 front, 1 right, 2 back, 3 left). */
export function faceIndex(angleDeg: number): number {
  return (((Math.round(angleDeg / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

export function createPlaneMap(dims: BoxDims, angleDeg = 0): RimMap {
  const q = faceIndex(angleDeg);
  const odd = q % 2 === 1;
  const halfWb = (odd ? dims.bottom[1] : dims.bottom[0]) / 2;
  const depthB = (odd ? dims.bottom[0] : dims.bottom[1]) / 2;
  const halfWt = Math.min(odd ? dims.top[1] : dims.top[0], 2 * halfWb) / 2;
  const depthT = Math.min(odd ? dims.top[0] : dims.top[1], 2 * depthB) / 2;
  const H = dims.H;
  if (!(halfWb > 0 && depthB > 0 && H > 0)) throw new Error('Invalid square base');
  const d = depthB - depthT;
  const s = Math.hypot(d, H);
  const nY = -H / s;
  const nZ = d / s;
  const α = (q * Math.PI) / 2;
  const ca = Math.cos(α);
  const sa = Math.sin(α);
  const rot = (x: number, y: number, z: number): Vec3 => [x * ca - y * sa, x * sa + y * ca, z];
  const unrot = (x: number, y: number): Vec2 => [x * ca + y * sa, -x * sa + y * ca];
  const halfW = (v: number) => halfWb + ((halfWt - halfWb) * v) / s;

  return {
    kind: 'plane',
    frustum: { Rb: halfWb, Rt: halfWt, H },
    slant: s,
    angle: α,
    radiusAt: halfW,
    // 90° of the base = one whole face
    arcForDeg: (deg, v) => (deg / 90) * 2 * halfW(v),
    arcToDeg: (arc, v) => (arc / (2 * halfW(v))) * 90,
    maxArc: (v) => Math.max(1, 2 * halfW(v) - 0.6),
    unbend: (X, Y) => [X, Y],
    bend: (u, v) => [u, v],
    frameAt: (arc, v): Frame2 => ({ x: arc, y: v, rot: 0 }),
    scaleArc: (arc) => arc,
    toWorld(X, Y, w) {
      return rot(X, -depthB + (d * Y) / s + w * nY, (H * Y) / s + w * nZ);
    },
    toFlat([px, py, pz]) {
      const [x, y] = unrot(px, py);
      // (y + depthB, pz) = v·(d/s, H/s) + w·(−H/s, d/s)
      const ry = y + depthB;
      const v = ry * (d / s) + pz * (H / s);
      const w = -ry * (H / s) + pz * (d / s);
      return [x, v, w];
    },
    normalAt() {
      return rot(0, nY, nZ);
    },
  };
}
