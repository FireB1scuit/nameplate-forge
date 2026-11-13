import { describe, expect, it } from 'vitest';
import { createRimMap, degToArc, type Vec3 } from '../conemap';

const close = (a: number[], b: number[], eps = 1e-9) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)));

// 32 mm base with the placeholder rule: top = bottom − 3.4, height 4.0
const cone32 = { Rb: 16, Rt: 14.3, H: 4 };
const mdf32 = { Rb: 16, Rt: 16, H: 3 };

describe('cone map', () => {
  const map = createRimMap(cone32, 0);

  it('is a cone with the right slant length', () => {
    expect(map.kind).toBe('cone');
    expect(map.slant).toBeCloseTo(Math.hypot(1.7, 4), 12);
  });

  it('maps the plate centre bottom edge to the front of the base', () => {
    // straight frame (u=0, v=0) -> flat -> world: bottom edge, front (−Y)
    const [X, Y] = map.bend(0, 0, 0);
    close(map.toWorld(X, Y, 0), [0, -16, 0]);
  });

  it('maps the top edge to the top radius and height', () => {
    const [X, Y] = map.bend(0, map.slant, 0);
    close(map.toWorld(X, Y, 0), [0, -14.3, 4]);
  });

  it('moves to +X (viewer right) for positive u', () => {
    const quarter = degToArc(map, 90, 0); // 90° of rim at the bottom edge
    const [X, Y] = map.bend(quarter, 0, 0);
    close(map.toWorld(X, Y, 0), [16, 0, 0], 1e-9);
  });

  it('preserves arc length along a horizontal circle (developable)', () => {
    const v = 1.3;
    const arc = 5;
    const f = map.frameAt(arc, v);
    const P = map.toWorld(f.x, f.y, 0);
    const r = map.radiusAt(v);
    const α = Math.atan2(P[0], -P[1]);
    expect(α * r).toBeCloseTo(arc, 9);
    expect(P[2]).toBeCloseTo((v * 4) / map.slant, 9);
  });

  it('preserves distances in the flat layout locally (isometry)', () => {
    // two nearby points in flat space -> world distance equals flat distance
    const f = map.frameAt(3, 2);
    const a: [number, number] = [f.x, f.y];
    const b: [number, number] = [f.x + 0.01, f.y + 0.007];
    const Pa = map.toWorld(a[0], a[1], 0);
    const Pb = map.toWorld(b[0], b[1], 0);
    const dWorld = Math.hypot(Pa[0] - Pb[0], Pa[1] - Pb[1], Pa[2] - Pb[2]);
    expect(dWorld).toBeCloseTo(Math.hypot(0.01, 0.007), 6);
  });

  it('offsets along the outward surface normal', () => {
    const f = map.frameAt(0, 1);
    const P0 = map.toWorld(f.x, f.y, 0);
    const P1 = map.toWorld(f.x, f.y, 0.5);
    const n = map.normalAt(0);
    close(
      [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]],
      n.map((c) => c * 0.5),
    );
    expect(Math.hypot(...n)).toBeCloseTo(1, 12);
    // the normal is perpendicular to the slant direction (−(Rb−Rt), 0, H) at the front
    expect(n[1] * 1.7 + n[2] * 4).toBeCloseTo(0, 12); // front: radial = −Y
  });

  it('round-trips world <-> flat', () => {
    const rotated = createRimMap(cone32, 37);
    for (const [u, v, w] of [
      [0, 0, 0],
      [4.2, 1.1, 0.3],
      [-11, 3.9, 1.2],
      [20, 2, 0.05],
    ]) {
      const [X, Y] = rotated.bend(u, v, 2);
      const P = rotated.toWorld(X, Y, w);
      close(rotated.toFlat(P), [X, Y, w], 1e-9);
    }
  });

  it('applies the placement angle', () => {
    const m90 = createRimMap(cone32, 90);
    const [X, Y] = m90.bend(0, 0, 0);
    close(m90.toWorld(X, Y, 0), [16, 0, 0]);
  });

  it('keeps glyph frames tangent to the arc', () => {
    const f0 = map.frameAt(0, 2);
    expect(f0.rot).toBe(0);
    const f = map.frameAt(6, 2);
    // the tangent direction in flat space is perpendicular to the radius vector
    const radial = [f.x, f.y];
    const tangent = [Math.cos(f.rot), Math.sin(f.rot)];
    expect(radial[0] * tangent[0] + radial[1] * tangent[1]).toBeCloseTo(0, 9);
  });

  it('scales arc lengths between circles', () => {
    const ratio = map.scaleArc(10, 0, map.slant);
    expect(ratio).toBeCloseTo(10 * (14.3 / 16), 9);
  });

  it('rejects rims that flare outwards', () => {
    expect(() => createRimMap({ Rb: 10, Rt: 12, H: 3 })).toThrow();
  });
});

describe('cylinder map (flat MDF edge)', () => {
  const map = createRimMap(mdf32, 0);

  it('switches to the cylinder special case', () => {
    expect(map.kind).toBe('cylinder');
    expect(map.slant).toBe(3);
  });

  it('maps the layout as a plain rectangle', () => {
    expect(map.bend(5, 1, 0)).toEqual([5, 1]);
    expect(map.frameAt(5, 1)).toEqual({ x: 5, y: 1, rot: 0 });
    close(map.toWorld(0, 2, 0), [0, -16, 2]);
    close(map.toWorld(0, 2, 0.5), [0, -16.5, 2]);
  });

  it('wraps x as arc length', () => {
    const quarter = (Math.PI / 2) * 16;
    close(map.toWorld(quarter, 0, 0), [16, 0, 0]);
  });

  it('round-trips', () => {
    const m = createRimMap(mdf32, -45);
    const pts: Vec3[] = [
      [1, 1, 0],
      [-7, 2.5, 0.8],
    ];
    for (const p of pts) close(m.toFlat(m.toWorld(...p)), p, 1e-9);
  });

  it('is used for nearly-vertical rims', () => {
    expect(createRimMap({ Rb: 16, Rt: 16 - 1e-5, H: 3 }).kind).toBe('cylinder');
  });
});
