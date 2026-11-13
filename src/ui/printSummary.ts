import { useStore } from '../state/store';

/** Compact one-line status for the phone viewport. */
export function usePrintSummary(): { ok: boolean; text: string } | null {
  const r = useStore((s) => s.build.result);
  if (!r) return null;
  const problems = r.warnings.filter((w) => w.level !== 'info');
  if (!r.stats.watertight) return { ok: false, text: 'Mesh problem' };
  if (problems.length === 0) return { ok: true, text: 'Print OK' };
  return {
    ok: false,
    text: problems.length === 1 ? '1 warning' : `${problems.length} warnings`,
  };
}
