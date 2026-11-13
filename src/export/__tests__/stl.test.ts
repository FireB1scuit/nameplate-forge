import { describe, expect, it } from 'vitest';
import { readBinaryStl, writeBinaryStl } from '../stl';

describe('binary STL', () => {
  it('writes header, count, normals and vertices', () => {
    // one triangle in the XY plane, CCW seen from +Z
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 1, 2]);
    const buf = writeBinaryStl(positions, indices);
    expect(buf.byteLength).toBe(84 + 50);
    const view = new DataView(buf);
    expect(view.getUint32(80, true)).toBe(1);
    expect([
      view.getFloat32(84, true),
      view.getFloat32(88, true),
      view.getFloat32(92, true),
    ]).toEqual([0, 0, 1]);
    const { triangles, vertices } = readBinaryStl(buf);
    expect(triangles).toBe(1);
    expect(Array.from(vertices)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });
});
