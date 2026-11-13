import type { BuildWarning } from '../geometry/build';
import { READABLE_SIZE } from '../geometry/build';
import { useStore } from '../state/store';

const fmt1 = (n: number) => n.toFixed(1);

/** One-click fixes for warnings (plan.md §4: bad input never blocks export). */
function useFix(w: BuildWarning): { label: string; run: () => void } | null {
  const update = useStore((s) => s.update);
  const design = useStore((s) => s.design);
  switch (w.code) {
    case 'readability':
    case 'too-small':
      if (design.text.size1 < READABLE_SIZE && !useStore.getState().build.result?.fit.shrunk) {
        return {
          label: `Use ${READABLE_SIZE} mm`,
          run: () => update((d) => void (d.text.size1 = READABLE_SIZE)),
        };
      }
      if (design.plate.width.mode === 'auto' && design.plate.maxDeg < 300) {
        return {
          label: 'Widen plate',
          run: () => update((d) => void (d.plate.maxDeg = Math.min(300, d.plate.maxDeg + 30))),
        };
      }
      return null;
    case 'overflow':
      if (!design.text.autoShrink) {
        return { label: 'Auto-shrink', run: () => update((d) => void (d.text.autoShrink = true)) };
      }
      if (design.plate.width.mode === 'auto' && design.plate.maxDeg < 300) {
        return {
          label: 'Widen plate',
          run: () => update((d) => void (d.plate.maxDeg = Math.min(300, d.plate.maxDeg + 30))),
        };
      }
      return null;
    case 'clipped':
      return { label: 'Auto width', run: () => update((d) => void (d.plate.width.mode = 'auto')) };
    case 'border-touch':
      return {
        label: 'Taller plate',
        run: () =>
          update(
            (d) => void (d.plate.height = Math.min(8, Math.round((d.text.size1 + 1.6) * 10) / 10)),
          ),
      };
    default:
      return null;
  }
}

function WarningLine({ w }: { w: BuildWarning }) {
  const fix = useFix(w);
  const cls = w.level === 'error' ? 'error' : w.level === 'warn' ? 'warn' : 'note';
  return (
    <li className={cls}>
      {w.message}
      {fix && (
        <>
          {' '}
          <button type="button" className="fix-btn" onClick={fix.run}>
            {fix.label}
          </button>
        </>
      )}
    </li>
  );
}

export function PrintCheck({ className = 'print-check' }: { className?: string }) {
  const build = useStore((s) => s.build);
  const printer = useStore((s) => s.ui.printer);
  const r = build.result;

  return (
    <div className={className} role="status" aria-live="polite">
      <span className="lbl">Print check · {printer === 'resin' ? 'Resin' : 'FDM'}</span>
      {build.status === 'error' && <span className="error">Build failed: {build.error}</span>}
      {!r && build.status !== 'error' && <span className="note">Building…</span>}
      {r && (
        <ul>
          <li className={r.stats.watertight && r.stats.components === 1 ? 'ok' : 'error'}>
            {r.stats.watertight
              ? r.stats.components === 1
                ? 'Watertight, single solid'
                : `Watertight, ${r.stats.components} separate parts`
              : `Not watertight (${r.stats.status})`}
          </li>
          {r.warnings
            .filter((w) => w.code !== 'not-watertight')
            .map((w) => (
              <WarningLine key={w.code} w={w} />
            ))}
          {r.fit.chars > 0 &&
            r.warnings.every((w) => w.code !== 'readability' && w.code !== 'too-small') && (
              <li className="ok">Letters {fmt1(r.fit.sizeUsed)} mm: good to read</li>
            )}
          <li className="note">
            {r.stats.triangles.toLocaleString()} triangles · plate {fmt1(r.stats.plate.width)} ×{' '}
            {fmt1(r.stats.plate.height)} × {fmt1(r.stats.plate.thickness)} mm ·{' '}
            {Math.round(r.stats.buildMs)} ms
          </li>
          <li className="note">
            Bounding box {fmt1(r.stats.bbox.max[0] - r.stats.bbox.min[0])} ×{' '}
            {fmt1(r.stats.bbox.max[1] - r.stats.bbox.min[1])} ×{' '}
            {fmt1(r.stats.bbox.max[2] - r.stats.bbox.min[2])} mm
          </li>
        </ul>
      )}
    </div>
  );
}
