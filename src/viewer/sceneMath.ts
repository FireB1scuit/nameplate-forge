/**
 * Camera framing for the presets. Geometry is built Z-up (mm); the scene is three.js Y-up, so a
 * world point (x, y, z) shows at (x, z, −y). The front of the base (world −Y) faces +Z in the scene.
 */
import type { CameraPreset } from '../state/store';

export type V3 = [number, number, number];

export interface CameraPose {
  position: V3;
  target: V3;
}

/** Z-up world -> three.js Y-up scene */
export const toScene = ([x, y, z]: V3): V3 => [x, z, -y];

export interface FramingInput {
  preset?: CameraPreset;
  /** bottom radius, top radius, height (mm) */
  Rb: number;
  Rt: number;
  H: number;
  /** plate azimuth in degrees (0 = front) */
  angleDeg: number;
  /** plate bounding box in world (Z-up) coords, if built */
  plateBox?: { min: V3; max: V3 };
  /** vertical field of view (degrees) and aspect ratio of the canvas */
  fov: number;
  aspect: number;
}

function distanceFor(radius: number, fov: number, aspect: number): number {
  const vHalf = ((fov / 2) * Math.PI) / 180;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const half = Math.min(vHalf, hHalf);
  return radius / Math.sin(half);
}

/** Direction from the target towards the camera, in scene coords. */
function dir(azimuthDeg: number, elevationDeg: number): V3 {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  // azimuth 0 = scene +Z (front of the base); positive azimuth -> scene +X (viewer's right)
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}

export function framePreset(preset: CameraPreset, f: FramingInput): CameraPose {
  const { Rb, H, angleDeg, fov, aspect } = f;
  const baseTarget: V3 = [0, H / 2, 0];
  const baseRadius = Math.hypot(Rb, H / 2) * 1.08;

  const place = (target: V3, radius: number, az: number, el: number): CameraPose => {
    const d = distanceFor(radius, fov, aspect);
    const v = dir(az, el);
    return {
      target,
      position: [target[0] + v[0] * d, target[1] + v[1] * d, target[2] + v[2] * d],
    };
  };

  switch (preset) {
    case 'front':
      return place(baseTarget, baseRadius, angleDeg, 18);
    case 'side':
      return place(baseTarget, baseRadius, angleDeg + 90, 10);
    case 'top':
      // tiny offset towards the plate keeps OrbitControls away from the pole
      return place([0, H, 0], Rb * 1.08, angleDeg, 89.5);
    case 'iso':
      return place(baseTarget, baseRadius, angleDeg + 40, 35);
    case 'fit': {
      if (!f.plateBox) return place(baseTarget, baseRadius, angleDeg, 18);
      const { min, max } = f.plateBox;
      const c = toScene([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]);
      const r = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 1.1;
      return place(c, r, angleDeg, 12);
    }
  }
}
