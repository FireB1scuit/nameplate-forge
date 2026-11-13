/**
 * Flat-for-print orientation (plan.md §5.9): rotate the warped plate so the outward rim normal at
 * its centre points up (+Z) — the back face then faces the bed — and drop it onto Z = 0, centred
 * on the origin.
 */
export type V3 = [number, number, number];

/** Rotation matrix (row-major 3×3) that maps unit vector `n` onto +Z. */
export function rotationToZ(n: V3): number[][] {
  const l = Math.hypot(...n);
  const [x, y, z] = [n[0] / l, n[1] / l, n[2] / l];
  // axis = n × Z = (y, −x, 0), angle = acos(z)
  const s = Math.hypot(x, y);
  if (s < 1e-12) {
    return z > 0
      ? [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]
      : [
          [1, 0, 0],
          [0, -1, 0],
          [0, 0, -1],
        ];
  }
  const kx = y / s;
  const ky = -x / s;
  const c = z;
  const sn = s;
  const v = 1 - c;
  return [
    [c + kx * kx * v, kx * ky * v, ky * sn],
    [ky * kx * v, c + ky * ky * v, -kx * sn],
    [-ky * sn, kx * sn, c],
  ];
}

/**
 * Rotate several meshes (parts of one plate) by the same rotation so `normal` → +Z, then centre
 * them together in XY and put the lowest point on Z = 0.
 */
export function orientFlatMany(list: Float32Array[], normal: V3): Float32Array[] {
  const R = rotationToZ(normal);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  const outs = list.map((positions) => {
    const out = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const p = [positions[i], positions[i + 1], positions[i + 2]];
      for (let r = 0; r < 3; r++) out[i + r] = R[r][0] * p[0] + R[r][1] * p[1] + R[r][2] * p[2];
      minX = Math.min(minX, out[i]);
      maxX = Math.max(maxX, out[i]);
      minY = Math.min(minY, out[i + 1]);
      maxY = Math.max(maxY, out[i + 1]);
      minZ = Math.min(minZ, out[i + 2]);
    }
    return out;
  });
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const out of outs) {
    for (let i = 0; i < out.length; i += 3) {
      out[i] -= cx;
      out[i + 1] -= cy;
      out[i + 2] -= minZ;
    }
  }
  return outs;
}

/** Rotate so `normal` → +Z, then centre in XY and put the lowest point on Z = 0. */
export function orientFlat(positions: Float32Array, normal: V3): Float32Array {
  return orientFlatMany([positions], normal)[0];
}
