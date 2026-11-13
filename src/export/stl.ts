/**
 * Binary STL writer (plan.md §5.9). Units are mm; normals are computed per triangle.
 */
const HEADER = 'Nameplate Forge STL (mm)';

export function writeBinaryStl(positions: Float32Array, indices: Uint32Array): ArrayBuffer {
  const triCount = Math.floor(indices.length / 3);
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  for (let i = 0; i < 80; i++) view.setUint8(i, i < HEADER.length ? HEADER.charCodeAt(i) : 0x20);
  view.setUint32(80, triCount, true);

  let off = 84;
  const put = (v: number) => {
    view.setFloat32(off, v, true);
    off += 4;
  };
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    put(nx);
    put(ny);
    put(nz);
    put(ax);
    put(ay);
    put(az);
    put(bx);
    put(by);
    put(bz);
    put(cx);
    put(cy);
    put(cz);
    view.setUint16(off, 0, true);
    off += 2;
  }
  return buffer;
}

/** Parse a binary STL back into triangles (used by tests). */
export function readBinaryStl(buffer: ArrayBuffer): { triangles: number; vertices: Float32Array } {
  const view = new DataView(buffer);
  const triangles = view.getUint32(80, true);
  const vertices = new Float32Array(triangles * 9);
  let off = 84;
  for (let t = 0; t < triangles; t++) {
    off += 12; // skip normal
    for (let k = 0; k < 9; k++) {
      vertices[t * 9 + k] = view.getFloat32(off, true);
      off += 4;
    }
    off += 2;
  }
  return { triangles, vertices };
}
