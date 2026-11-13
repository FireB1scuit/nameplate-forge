import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { getTheme } from '../data/themes';
import { resolveFrustum } from '../state/schema';
import { useStore } from '../state/store';
import { BaseMesh } from './BaseMesh';
import { PlateMesh } from './PlateMesh';
import { framePreset, type CameraPose, type FramingInput } from './sceneMath';

const FOV = 32;
const ANIM_MS = 450;

interface CameraAnim {
  /** framing inputs; the pose is computed on the first frame, when the canvas size is known */
  framing: Omit<FramingInput, 'aspect'>;
  to: CameraPose | null;
  from: CameraPose | null;
  t0: number;
  Rb: number;
}

/** Animates the camera to the requested preset (and re-frames when the base size changes). */
function CameraRig() {
  const hasControls = useThree((s) => s.controls !== null);
  const nonce = useStore((s) => s.ui.camera.nonce);
  const base = useStore((s) => s.design.base);
  const anim = useRef<CameraAnim | null>(null);
  const { Rb, Rt, H } = resolveFrustum(base);

  useEffect(() => {
    const s = useStore.getState();
    anim.current = {
      framing: {
        preset: s.ui.camera.preset,
        Rb,
        Rt,
        H,
        angleDeg: s.design.plate.angleDeg,
        plateBox: s.build.result?.stats.bbox,
        fov: FOV,
      },
      to: null,
      from: null,
      t0: performance.now(),
      Rb,
    };
  }, [nonce, Rb, Rt, H, hasControls]);

  // r3f idiom: camera + controls are mutated imperatively, once per frame
  useFrame((state) => {
    const a = anim.current;
    const camera = state.camera as PerspectiveCamera;
    const controls = state.controls as OrbitControlsImpl | null;
    if (!a || !controls) return;
    if (!a.from || !a.to) {
      const t = controls.target;
      const { preset, ...framing } = a.framing;
      a.to = framePreset(preset ?? 'front', {
        ...framing,
        aspect: state.size.width / Math.max(1, state.size.height),
      });
      a.from = { position: camera.position.toArray(), target: [t.x, t.y, t.z] };
      a.t0 = performance.now();
      controls.minDistance = Math.max(2, a.Rb * 0.15);
      controls.maxDistance = a.Rb * 20 + 50;
      camera.near = Math.max(0.05, a.Rb * 0.01);
      camera.far = a.Rb * 60 + 500;
      camera.updateProjectionMatrix();
    }
    const k = Math.min(1, (performance.now() - a.t0) / ANIM_MS);
    const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
    const { from, to } = a;
    const lerp = (p: number[], q: number[]) => p.map((v, i) => v + (q[i] - v) * e);
    camera.position.fromArray(lerp(from.position, to.position));
    controls.target.fromArray(lerp(from.target, to.target));
    controls.update();
    if (k >= 1) anim.current = null;
  });

  return null;
}

function Scene() {
  const design = useStore((s) => s.design);
  const result = useStore((s) => s.build.result);
  const showBase = useStore((s) => s.ui.showBase);
  const wireframe = useStore((s) => s.ui.wireframe);
  const { Rb, Rt, H } = resolveFrustum(design.base);
  const theme = getTheme(design.style.themeId);
  const shadowScale = Rb * 3.2;

  return (
    <>
      <hemisphereLight args={['#f4f1ea', '#1a1b20', 0.55]} />
      <directionalLight
        position={new Vector3(0.6, 1, 0.9).multiplyScalar(Rb * 4)}
        intensity={1.7}
      />
      <directionalLight
        position={new Vector3(-1, 0.6, -0.8).multiplyScalar(Rb * 4)}
        intensity={0.5}
        color="#bcd0ff"
      />
      {/* Studio reflections built from Lightformers: nothing is fetched from a CDN */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 6]} scale={[10, 4, 1]} />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[-6, 2, -2]}
          rotation-y={Math.PI / 2}
          scale={[8, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.0}
          position={[6, 1, 1]}
          rotation-y={-Math.PI / 2}
          scale={[8, 2, 1]}
        />
        <Lightformer
          form="ring"
          intensity={0.8}
          position={[0, 8, 0]}
          rotation-x={Math.PI / 2}
          scale={4}
        />
      </Environment>

      {showBase && <BaseMesh Rb={Rb} Rt={Rt} H={H} />}

      {result && (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <PlateMesh mesh={result.mesh} material={theme.material} wireframe={wireframe} />
        </group>
      )}

      <ContactShadows
        position={[0, 0.002, 0]}
        scale={shadowScale}
        far={Math.max(H * 2, 6)}
        blur={2.2}
        opacity={0.65}
        resolution={512}
        frames={Infinity}
      />
      <CameraRig />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
    </>
  );
}

export function Viewport() {
  return (
    <Canvas
      className="viewport-canvas"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: FOV, near: 0.1, far: 5000, position: [0, 20, 90] }}
      aria-label="3D preview of the nameplate on the base. Drag to orbit, scroll to zoom."
    >
      <Scene />
    </Canvas>
  );
}
