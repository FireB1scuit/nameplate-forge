/**
 * Print sprue (plan.md §5.9): several flat-oriented plates in one column inside a rectangular frame
 * (1.2 × 1.2 mm bars) with thin gates (0.5 mm) from each plate end to the frame. One solid.
 */
import type { Manifold, ManifoldToplevel, Vec3 } from 'manifold-3d';

export const BAR = 1.2;
export const GATE_D = 0.5;
const GAP = 3;

/**
 * `plates` must already be oriented flat (back face down, lowest point on z = 0).
 * Takes ownership of nothing: the caller still deletes its inputs. Returns a new manifold.
 */
export function buildSprue(wasm: ManifoldToplevel, plates: Manifold[]): Manifold {
  const { Manifold } = wasm;
  const temp: Manifold[] = [];
  const keep = <T extends Manifold>(m: T) => {
    temp.push(m);
    return m;
  };
  try {
    const boxes = plates.map((p) => p.boundingBox());
    const width = Math.max(...boxes.map((b) => b.max[0] - b.min[0]));
    const placed: Manifold[] = [];
    const gates: Manifold[] = [];
    let y = BAR + GAP;
    const xL = -width / 2 - GAP - BAR; // inner edge of the left bar is xL + BAR
    const xR = width / 2 + GAP;
    plates.forEach((p, i) => {
      const b = boxes[i];
      const h = b.max[1] - b.min[1];
      const cx = (b.min[0] + b.max[0]) / 2;
      const m = keep(p.translate([-cx, y - b.min[1], -b.min[2]]));
      placed.push(m);
      // gates: from each plate end (at mid height, near the bed) to the side bars
      const pb = m.boundingBox();
      const yc = (pb.min[1] + pb.max[1]) / 2;
      const zg = Math.min(BAR / 2, Math.max(GATE_D / 2, (pb.max[2] - pb.min[2]) / 3));
      const sphere = (c: Vec3) => keep(keep(Manifold.sphere(GATE_D / 2, 12)).translate(c));
      gates.push(
        keep(Manifold.hull([sphere([pb.min[0] + 0.4, yc, zg]), sphere([xL + BAR / 2, yc, zg])])),
        keep(Manifold.hull([sphere([pb.max[0] - 0.4, yc, zg]), sphere([xR + BAR / 2, yc, zg])])),
      );
      y += h + GAP;
    });
    const top = y;
    const bar = (x0: number, y0: number, x1: number, y1: number) =>
      keep(keep(Manifold.cube([x1 - x0, y1 - y0, BAR])).translate([x0, y0, 0]));
    const frame = [
      bar(xL, 0, xR + BAR, BAR),
      bar(xL, top, xR + BAR, top + BAR),
      bar(xL, 0, xL + BAR, top + BAR),
      bar(xR, 0, xR + BAR, top + BAR),
    ];
    return Manifold.union([...placed, ...gates, ...frame]);
  } finally {
    temp.forEach((m) => m.delete());
  }
}
