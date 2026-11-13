import { useEffect, useMemo } from 'react';
import { CircleGeometry, LatheGeometry, Vector2 } from 'three';

/** The base drawn as a lathed frustum (side) plus top and bottom caps. Scene units: mm, Y-up. */
export function BaseMesh({ Rb, Rt, H }: { Rb: number; Rt: number; H: number }) {
  const side = useMemo(
    () => new LatheGeometry([new Vector2(Rb, 0), new Vector2(Rt, H)], 160),
    [Rb, Rt, H],
  );
  const top = useMemo(() => new CircleGeometry(Rt, 160), [Rt]);
  const bottom = useMemo(() => new CircleGeometry(Rb, 160), [Rb]);
  useEffect(() => () => side.dispose(), [side]);
  useEffect(() => () => top.dispose(), [top]);
  useEffect(() => () => bottom.dispose(), [bottom]);

  return (
    <group>
      <mesh geometry={side} castShadow receiveShadow>
        <meshStandardMaterial color="#3A3C44" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh geometry={top} position={[0, H, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#45474F" roughness={0.85} metalness={0.02} />
      </mesh>
      <mesh geometry={bottom} position={[0, 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#2A2B31" roughness={0.9} />
      </mesh>
    </group>
  );
}
