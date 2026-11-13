/**
 * Viewer extras: 28 mm figure silhouette for scale, ruler/dimension overlay, idle auto-rotate and
 * PNG screenshots.
 */
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { BuildStats } from '../geometry/build';
import type { ResolvedBase } from '../state/schema';
import { useStore } from '../state/store';
import { registerCapture } from '../ui/actions';

/**
 * A generic "heroic 28 mm" trooper silhouette made of primitives (our own, no external model):
 * about 32 mm to the top of the head, eye level ≈ 28 mm. Scene units are mm, Y-up.
 */
export function Figure({ y }: { y: number }) {
  const mat = <meshStandardMaterial color="#7C808C" roughness={0.7} metalness={0.05} />;
  return (
    <group position={[0, y, 0]}>
      {/* legs */}
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 6.6, 0]} castShadow>
          <capsuleGeometry args={[1.6, 9.5, 4, 12]} />
          {mat}
        </mesh>
      ))}
      {/* feet */}
      {[-1.9, 1.9].map((x) => (
        <mesh key={`f${x}`} position={[x, 0.8, 1.2]} castShadow>
          <boxGeometry args={[2.6, 1.6, 4.6]} />
          {mat}
        </mesh>
      ))}
      {/* torso */}
      <mesh position={[0, 17.5, 0]} castShadow>
        <capsuleGeometry args={[3.6, 6.2, 4, 16]} />
        {mat}
      </mesh>
      {/* shoulders + arms */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 5, 21.2, 0]} castShadow>
            <sphereGeometry args={[2.2, 16, 12]} />
            {mat}
          </mesh>
          <mesh position={[s * 5.6, 16.5, 0.6]} rotation={[0.15, 0, s * 0.12]} castShadow>
            <capsuleGeometry args={[1.25, 7.5, 4, 12]} />
            {mat}
          </mesh>
        </group>
      ))}
      {/* head */}
      <mesh position={[0, 27.6, 0.2]} castShadow>
        <sphereGeometry args={[2.7, 20, 16]} />
        {mat}
      </mesh>
    </group>
  );
}

/** Width along the rim + height callout, drawn just outside the plate. */
export function Ruler({
  base,
  angleDeg,
  stats,
}: {
  base: ResolvedBase;
  angleDeg: number;
  stats: BuildStats;
}) {
  const round = base.shape === 'round' || base.shape === 'oval';
  const pts = useMemo(() => {
    const { min, max } = stats.bbox;
    if (!round) {
      // straight face: a line under the plate along its bounding box
      const yOut = min[1] - 1.5;
      return {
        arc: [
          [min[0], 0.3, -yOut],
          [max[0], 0.3, -yOut],
        ] as Array<[number, number, number]>,
        mid: [(min[0] + max[0]) / 2, 0.3, -yOut] as [number, number, number],
        end: [max[0] + 1, (min[2] + max[2]) / 2, -(min[1] + max[1]) / 2] as [
          number,
          number,
          number,
        ],
      };
    }
    const rx = base.bottom[0] / 2 + 1.6;
    const ry = base.bottom[1] / 2 + 1.6;
    const a0 = ((angleDeg - stats.plate.degrees / 2) * Math.PI) / 180;
    const a1 = ((angleDeg + stats.plate.degrees / 2) * Math.PI) / 180;
    const arc: Array<[number, number, number]> = [];
    for (let i = 0; i <= 48; i++) {
      const a = a0 + ((a1 - a0) * i) / 48;
      // world (x, y) = (r sin a, −r cos a); scene = (x, z, −y)
      arc.push([rx * Math.sin(a), 0.3, ry * Math.cos(a)]);
    }
    const am = (angleDeg * Math.PI) / 180;
    const ae = a1 + 0.05;
    return {
      arc,
      mid: [rx * Math.sin(am), 0.3, ry * Math.cos(am)] as [number, number, number],
      end: [(rx + 0.5) * Math.sin(ae), base.H / 2 + 0.4, (ry + 0.5) * Math.cos(ae)] as [
        number,
        number,
        number,
      ],
    };
  }, [base, angleDeg, stats, round]);

  return (
    <group>
      <Line points={pts.arc} color="#D4A853" lineWidth={1.5} />
      <Html position={pts.mid} center className="dim-label" zIndexRange={[5, 0]}>
        {stats.plate.width.toFixed(1)} mm{round ? ` · ${stats.plate.degrees.toFixed(0)}°` : ''}
      </Html>
      <Html position={pts.end} center className="dim-label" zIndexRange={[5, 0]}>
        ↕ {stats.plate.height.toFixed(1)} · {stats.plate.thickness.toFixed(1)} mm thick
      </Html>
    </group>
  );
}

/** Turns on OrbitControls.autoRotate after a few idle seconds (when enabled). */
export function AutoRotate() {
  const enabled = useStore((s) => s.ui.autoRotate);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const last = useRef(0);
  useEffect(() => {
    if (!controls) return;
    const mark = () => (last.current = performance.now());
    controls.addEventListener('start', mark);
    mark();
    return () => controls.removeEventListener('start', mark);
  }, [controls]);
  useFrame((state) => {
    // r3f idiom: controls are mutated imperatively inside the frame loop
    const c = state.controls as OrbitControlsImpl | null;
    if (!c) return;
    const on = enabled && performance.now() - last.current > 3000;
    if (c.autoRotate !== on) {
      c.autoRotate = on;
      c.autoRotateSpeed = 0.8;
    }
  });
  return null;
}

/** Registers a PNG capture of the current view for the screenshot button. */
export function CaptureHook() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    registerCapture(
      () =>
        new Promise((resolve) => {
          gl.render(scene, camera);
          gl.domElement.toBlob((b) => resolve(b), 'image/png');
        }),
    );
    return () => registerCapture(null);
  }, [gl, scene, camera]);
  return null;
}
