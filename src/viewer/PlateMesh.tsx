import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ThemeMaterial } from '../data/themes';
import type { MeshData } from '../geometry/build';

const CREASE_ANGLE = (35 * Math.PI) / 180;

/** The built plate. Geometry is Z-up world mm; the parent group rotates it into the Y-up scene. */
export function PlateMesh({
  mesh,
  material,
  wireframe,
}: {
  mesh: MeshData;
  material: ThemeMaterial;
  wireframe: boolean;
}) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    g.setIndex(new BufferAttribute(mesh.indices, 1));
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
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        wireframe={wireframe}
        envMapIntensity={1.1}
      />
    </mesh>
  );
}
