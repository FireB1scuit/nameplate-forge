/**
 * Rim mapping maths (plan.md §5.3).
 *
 * A round base's sloped rim is a frustum, which unrolls flat (a cone is developable).
 * Everything is laid out in that flat "layout space" and then warped back onto the rim.
 *
 * Conventions (all mm / radians internally):
 *  - World space is Z-up. The base sits on z = 0 with its axis on Z.
 *    Azimuth α = 0 is the FRONT of the base, which faces −Y. Increasing α moves towards +X,
 *    i.e. to the viewer's right when looking at the front.
 *  - Local "straight" plate coords: u = along the rim (mm), v = up the slant from the bottom edge (mm).
 *  - Flat layout space (cone): origin at the cone apex; the plate is centred on the **−Y** axis,
 *    so +X = along the rim (reading direction) and +Y = up the slant (towards the apex).
 *    (plan.md sketches +Y; −Y keeps the flat frame right-handed so text isn't mirrored.)
 *  - Flat layout space (cylinder / MDF edge): X = arc length at radius R, Y = height.
 *  - w = offset along the outward surface normal (0 = on the rim surface). The fit gap is added
 *    by the caller.
 */

export interface Frustum {
  /** bottom radius (mm) */
  Rb: number;
  /** top radius (mm) */
  Rt: number;
  /** vertical height of the rim (mm) */
  H: number;
}

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface Frame2 {
  x: number;
  y: number;
  /** rotation of the local +x axis, radians (CCW) */
  rot: number;
}

export interface RimMap {
  readonly kind: 'cone' | 'cylinder' | 'oval' | 'plane';
  readonly frustum: Frustum;
  /** slant length of the rim (mm); equals H for a cylinder */
  readonly slant: number;
  /** placement angle around the base (radians) */
  readonly angle: number;
  /** world radius of the rim at slant height v (mean radius for ovals, face half-width for planes) */
  radiusAt(v: number): number;
  /** arc length (mm) on the rim at slant height v that spans `deg` degrees of the base */
  arcForDeg(deg: number, v: number): number;
  /** inverse of arcForDeg */
  arcToDeg(arc: number, v: number): number;
  /** longest plate (arc length at slant height v) this surface can take */
  maxArc(v: number): number;
  /** Inverse of bend: flat layout point -> straight plate frame (u at refV, v). */
  unbend(X: number, Y: number, refV: number): Vec2;
  /**
   * Bend a point from the straight plate frame into flat layout space.
   * `u` is measured as arc length on the circle at slant height `refV`.
   */
  bend(u: number, v: number, refV: number): Vec2;
  /** Rigid frame at arc length `s` along the circle at slant height `v` (tangent to the arc). */
  frameAt(s: number, v: number): Frame2;
  /** Convert an arc length on the circle at `vFrom` to the same angular span on the circle at `vTo`. */
  scaleArc(s: number, vFrom: number, vTo: number): number;
  /** Flat layout space (+ normal offset w) -> world. */
  toWorld(X: number, Y: number, w: number): Vec3;
  /** World -> flat layout space (+ normal offset w). Inverse of toWorld. */
  toFlat(P: Vec3): Vec3;
  /** Outward unit surface normal at azimuth α (relative to the plate centre). */
  normalAt(theta: number): Vec3;
}

/** Never let a plate wrap more than this much of a round rim. */
export const MAX_WRAP_DEG = 330;

/** Below this |Rb − Rt| (mm) the rim is treated as a vertical cylinder (MDF edge). */
export const CYLINDER_EPS = 1e-3;

function wrapPi(a: number): number {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
}

export function createRimMap(frustum: Frustum, angleDeg = 0): RimMap {
  const { Rb, Rt, H } = frustum;
  if (!(Rb > 0) || !(Rt > 0) || !(H > 0)) {
    throw new Error(`Invalid frustum: Rb=${Rb} Rt=${Rt} H=${H}`);
  }
  if (Rt > Rb + CYLINDER_EPS) {
    throw new Error(`Rims that flare outwards (top ${Rt} > bottom ${Rb}) are not supported`);
  }
  const angle = (angleDeg * Math.PI) / 180;
  if (Math.abs(Rb - Rt) < CYLINDER_EPS) return cylinderMap(frustum, angle);
  return coneMap(frustum, angle);
}

function coneMap(frustum: Frustum, angle: number): RimMap {
  const { Rb, Rt, H } = frustum;
  const s = Math.hypot(Rb - Rt, H); // slant length
  const k = (Rb - Rt) / s; // sin(half apex angle), > 0
  const ρb = Rb / k; // unrolled radius of the bottom edge
  const nr = H / s; // radial component of the outward normal
  const nz = k; // vertical component of the outward normal

  const flatPoint = (ρ: number, φ: number): Vec2 => [ρ * Math.sin(φ), -ρ * Math.cos(φ)];

  return {
    kind: 'cone',
    frustum,
    slant: s,
    angle,
    radiusAt: (v) => Rb - (v * (Rb - Rt)) / s,
    arcForDeg: (deg, v) => ((deg * Math.PI) / 180) * (Rb - (v * (Rb - Rt)) / s),
    arcToDeg: (arc, v) => ((arc / (Rb - (v * (Rb - Rt)) / s)) * 180) / Math.PI,
    maxArc: (v) => ((MAX_WRAP_DEG * Math.PI) / 180) * (Rb - (v * (Rb - Rt)) / s),
    unbend(X, Y, refV) {
      const ρ = Math.hypot(X, Y);
      return [Math.atan2(X, -Y) * (ρb - refV), ρb - ρ];
    },
    bend(u, v, refV) {
      const ρ = ρb - v;
      const φ = u / (ρb - refV);
      return flatPoint(ρ, φ);
    },
    frameAt(arc, v) {
      const ρ = ρb - v;
      const φ = arc / ρ;
      const [x, y] = flatPoint(ρ, φ);
      return { x, y, rot: φ };
    },
    scaleArc: (arc, vFrom, vTo) => (arc * (ρb - vTo)) / (ρb - vFrom),
    toWorld(X, Y, w) {
      const ρ = Math.hypot(X, Y);
      const φ = Math.atan2(X, -Y);
      const d = ρb - ρ; // distance up the slant from the bottom edge
      const α = φ / k + angle;
      const r = ρ * k + w * nr; // = Rb − d·(Rb−Rt)/s, pushed out along the normal
      const z = (d * H) / s + w * nz;
      return [r * Math.sin(α), -r * Math.cos(α), z];
    },
    toFlat([px, py, pz]) {
      const α = Math.atan2(px, -py);
      const rxy = Math.hypot(px, py);
      // project (rxy, pz) onto the rim line through (Rb, 0) with direction (−k, H/s)
      const dr = rxy - Rb;
      const d = -dr * k + pz * nr;
      const w = dr * nr + pz * nz;
      const ρ = ρb - d;
      const φ = wrapPi(α - angle) * k;
      const [X, Y] = flatPoint(ρ, φ);
      return [X, Y, w];
    },
    normalAt(theta) {
      const α = theta + angle;
      return [nr * Math.sin(α), -nr * Math.cos(α), nz];
    },
  };
}

function cylinderMap(frustum: Frustum, angle: number): RimMap {
  const R = frustum.Rb;
  const H = frustum.H;
  return {
    kind: 'cylinder',
    frustum,
    slant: H,
    angle,
    radiusAt: () => R,
    arcForDeg: (deg) => ((deg * Math.PI) / 180) * R,
    arcToDeg: (arc) => ((arc / R) * 180) / Math.PI,
    maxArc: () => ((MAX_WRAP_DEG * Math.PI) / 180) * R,
    unbend: (X, Y) => [X, Y],
    bend: (u, v) => [u, v],
    frameAt: (arc, v) => ({ x: arc, y: v, rot: 0 }),
    scaleArc: (arc) => arc,
    toWorld(X, Y, w) {
      const α = X / R + angle;
      const r = R + w;
      return [r * Math.sin(α), -r * Math.cos(α), Y];
    },
    toFlat([px, py, pz]) {
      const α = Math.atan2(px, -py);
      const r = Math.hypot(px, py);
      return [wrapPi(α - angle) * R, pz, r - R];
    },
    normalAt(theta) {
      const α = theta + angle;
      return [Math.sin(α), -Math.cos(α), 0];
    },
  };
}

/** Arc length (mm) of `deg` degrees of rim at slant height v. */
export function degToArc(map: RimMap, deg: number, v: number): number {
  return map.arcForDeg(deg, v);
}

export function wrapAngle(a: number): number {
  return wrapPi(a);
}
