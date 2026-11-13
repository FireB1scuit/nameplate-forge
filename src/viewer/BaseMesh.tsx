import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { baseRing } from '../geometry/basemap';
import type { ResolvedBase } from '../state/schema';

/**
 * The base as a closed mesh (side + top + bottom), built from the same rings as the export solid.
 * World Z-up mm; the parent group rotates it into the Y-up scene like the plate.
 */
function baseGeometry(base: ResolvedBase): BufferGeometry {
  const n = base.shape === 'square' || base.shape === 'rect' ? 4 : 160;
  const bottom = baseRing(base, 0, n);
  const top = baseRing(base, 1, n);
  const count = bottom.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const [x, y] of bottom) pos.push(x, y, 0);
  for (const [x, y] of top) pos.push(x, y, base.H);
  const cb = pos.length / 3;
  pos.push(0, 0, 0);
  const ct = pos.length / 3;
  pos.push(0, 0, base.H);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    // side (counter-clockwise seen from outside)
    idx.push(i, j, count + j, i, count + j, count + i);
    // caps
    idx.push(ct, count + i, count + j);
    idx.push(cb, j, i);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  const creased = toCreasedNormals(g, (40 * Math.PI) / 180);
  g.dispose();
  return creased;
}

export function BaseMesh({ base }: { base: ResolvedBase }) {
  const key = JSON.stringify(base);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => baseGeometry(base), [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#3A3C44" roughness={0.75} metalness={0.05} />
    </mesh>
  );
}
