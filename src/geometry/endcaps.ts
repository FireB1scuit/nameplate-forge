/**
 * End-cap / icon artwork (plan.md §3.4 layer 3): SVG → normalised polygons.
 * Artwork is drawn as the LEFT end cap (facing outwards to the left); the right end is mirrored.
 */
import type { Vec2 } from './conemap';
import { parseSvg, type SvgShape } from './svg';

export interface IconArt {
  id: string;
  /** shapes normalised to height 1, centred on the origin, y-up */
  shapes: SvgShape[];
  /** width / height */
  aspect: number;
  warnings: string[];
}

export function iconFromSvg(id: string, svgText: string): IconArt {
  const parsed = parseSvg(svgText);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of parsed.shapes) {
    for (const c of s.contours) {
      for (const [x, y] of c) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const h = maxY - minY;
  const w = maxX - minX;
  if (!(h > 0 && w > 0)) {
    return { id, shapes: [], aspect: 1, warnings: [...parsed.warnings, 'Icon has no area'] };
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const shapes = parsed.shapes.map((s) => ({
    fillRule: s.fillRule,
    contours: s.contours.map((c) => c.map(([x, y]): Vec2 => [(x - cx) / h, (y - cy) / h])),
  }));
  return { id, shapes, aspect: w / h, warnings: parsed.warnings };
}

/** Place normalised icon art: scale to `size` mm high, optionally mirror, rotate, translate. */
export function placeIcon(
  art: IconArt,
  size: number,
  mirror: boolean,
  frame: { x: number; y: number; rot: number },
): SvgShape[] {
  const c = Math.cos(frame.rot);
  const s = Math.sin(frame.rot);
  return art.shapes.map((sh) => ({
    fillRule: sh.fillRule,
    contours: sh.contours.map((poly) => {
      const pts = poly.map(([x, y]): Vec2 => {
        const px = (mirror ? -x : x) * size;
        const py = y * size;
        return [frame.x + px * c - py * s, frame.y + px * s + py * c];
      });
      // mirroring flips the winding; restore it so NonZero fills behave the same
      return mirror ? pts.reverse() : pts;
    }),
  }));
}
