import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ThemeMaterial } from '../data/themes';
import type { MeshData } from '../geometry/build';

const CREASE_ANGLE = (35 * Math.PI) / 180;

/**
 * The built plate. Geometry is Z-up world mm; the parent group rotates it into the Y-up scene.
 * Triangles from text/decoration form a second material group, used by the painted preview.
 */
export function PlateMesh({
  mesh,
  material,
  paint,
  painted,
  wireframe,
}: {
  mesh: MeshData;
  material: ThemeMaterial;
  paint: string;
  painted: boolean;
  wireframe: boolean;
}) {
  const geometry = useMemo(() => {
    const triCount = mesh.indices.length / 3;
    const isPaint = new Uint8Array(triCount);
    for (const [start, count] of mesh.paint) isPaint.fill(1, start, start + count);
    // plate triangles first, painted ones after, so each material is one draw group
    const ordered = new Uint32Array(mesh.indices.length);
    let k = 0;
    for (const want of [0, 1]) {
      for (let t = 0; t < triCount; t++) {
        if (isPaint[t] !== want) continue;
        ordered[k++] = mesh.indices[t * 3];
        ordered[k++] = mesh.indices[t * 3 + 1];
        ordered[k++] = mesh.indices[t * 3 + 2];
      }
    }
    const plateTris = triCount - isPaint.reduce((a, b) => a + b, 0);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    g.setIndex(new BufferAttribute(ordered, 1));
    g.addGroup(0, plateTris * 3, 0);
    g.addGroup(plateTris * 3, (triCount - plateTris) * 3, 1);
    // sharp edges stay sharp, curved faces stay smooth
    const creased = toCreasedNormals(g, CREASE_ANGLE);
    g.dispose();
    creased.computeBoundingSphere();
    return creased;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        attach="material-0"
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        wireframe={wireframe}
        envMapIntensity={1.1}
      />
      <meshStandardMaterial
        attach="material-1"
        color={painted ? paint : material.color}
        metalness={painted ? 0.1 : material.metalness}
        roughness={painted ? 0.6 : material.roughness}
        wireframe={wireframe}
        envMapIntensity={1.1}
      />
    </mesh>
  );
}
