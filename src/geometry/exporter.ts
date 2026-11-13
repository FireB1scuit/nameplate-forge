/**
 * Export pipeline (plan.md §3.6, §5.9): STL / 3MF, in place or flat for printing, optionally with
 * the base, and batch exports (a ZIP of files). Pure, so it runs in the worker and in
 * Node tests.
 */
import { zipSync } from 'fflate';
import type { ManifoldToplevel } from 'manifold-3d';
import { getTheme } from '../data/themes';
import { orientFlat, orientFlatMany } from '../export/orient';
import { writeBinaryStl } from '../export/stl';
import { write3mf, type MeshPart } from '../export/threemf';
import { resolveBase, type Design } from '../state/schema';
import { baseSolid } from './basemap';
import {
  buildPlate,
  planLayout,
  type BuildStats,
  type BuildWarning,
  type FitInfo,
  type FontProvider,
  type Printer,
} from './build';

export type ExportFormat = 'stl' | '3mf';
export type Orientation = 'inplace' | 'flat';

export interface ExportOptions {
  format: ExportFormat;
  orientation: Orientation;
  /** plate + base as one solid (STL) / two objects (3MF) */
  withBase: boolean;
  printer: Printer;
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'stl',
  orientation: 'inplace',
  withBase: false,
  printer: 'resin',
};

export interface ExportResult {
  data: Uint8Array;
  ext: 'stl' | '3mf' | 'zip';
  mime: string;
  stats: BuildStats;
  warnings: BuildWarning[];
}

function slug(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .slice(0, 40) || 'blank'
  );
}

export function baseFileName(design: Design): string {
  const b = design.base;
  const size =
    b.shape === 'oval' || b.shape === 'rect' ? `${b.bottom[0]}x${b.bottom[1]}` : `${b.bottom[0]}`;
  const edge = b.edge === 'vertical' ? '-mdf' : '';
  return `nameplate-${slug(design.text.line1)}-${size}mm${edge}`;
}

function u8(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

export async function exportDesign(
  wasm: ManifoldToplevel,
  assets: FontProvider,
  design: Design,
  opts: ExportOptions,
): Promise<ExportResult> {
  const theme = getTheme(design.style.themeId);
  const flat = opts.orientation === 'flat' && !opts.withBase;
  if (opts.format === 'stl') {
    const res = await buildPlate(wasm, assets, design, {
      quality: 'export',
      printer: opts.printer,
      withBase: opts.withBase,
      strokeCheck: false,
    });
    const positions = flat ? orientFlat(res.mesh.positions, res.normal) : res.mesh.positions;
    return {
      data: u8(writeBinaryStl(positions, res.mesh.indices)),
      ext: 'stl',
      mime: 'model/stl',
      stats: res.stats,
      warnings: res.warnings,
    };
  }
  // 3MF: plate and details (text, border, icons) as separate objects
  const res = await buildPlate(wasm, assets, design, {
    quality: 'export',
    printer: opts.printer,
    parts: true,
    strokeCheck: false,
  });
  const p = res.parts!;
  const meshes = [p.plate, ...(p.details ? [p.details] : [])];
  const oriented = flat
    ? orientFlatMany(
        meshes.map((m) => m.positions),
        res.normal,
      )
    : meshes.map((m) => m.positions);
  const parts: MeshPart[] = [
    {
      name: 'Plate',
      positions: oriented[0],
      indices: p.plate.indices,
      color: theme.material.color,
    },
  ];
  if (p.details) {
    parts.push({
      name: 'Text',
      positions: oriented[1],
      indices: p.details.indices,
      color: theme.paint,
    });
  }
  if (opts.withBase) {
    // the base ships as its own object, in place under the plate
    const b = baseSolid(wasm, resolveBase(design.base));
    const mesh = b.getMesh();
    const np = mesh.numProp;
    const pos = new Float32Array((mesh.vertProperties.length / np) * 3);
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] = mesh.vertProperties[i * np];
      pos[i * 3 + 1] = mesh.vertProperties[i * np + 1];
      pos[i * 3 + 2] = mesh.vertProperties[i * np + 2];
    }
    parts.push({
      name: 'Base',
      positions: pos,
      indices: new Uint32Array(mesh.triVerts),
      color: '#3A3C44',
    });
    b.delete();
  }
  return {
    data: write3mf(parts, design.text.line1 || 'Nameplate'),
    ext: '3mf',
    mime: 'model/3mf',
    stats: res.stats,
    warnings: res.warnings,
  };
}

export interface BatchRow {
  fit: FitInfo;
  warnings: BuildWarning[];
}

/** Fit check for many designs (no wasm needed: layout only). */
export async function planBatch(assets: FontProvider, designs: Design[]): Promise<BatchRow[]> {
  const out: BatchRow[] = [];
  for (const d of designs) {
    const font = await assets.get(d.text.fontId);
    const icon =
      d.style.endCaps.icon !== 'none' && d.style.endCaps.icon !== 'rivet' && assets.icon
        ? await assets.icon(d.style.endCaps.icon)
        : null;
    const plan = planLayout(d, font, icon);
    out.push({ fit: plan.fit, warnings: plan.warnings });
  }
  return out;
}

export interface BatchOptions {
  format: ExportFormat;
  orientation: Orientation;
  printer: Printer;
}

export async function exportBatch(
  wasm: ManifoldToplevel,
  assets: FontProvider,
  designs: Design[],
  opts: BatchOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<{ data: Uint8Array; ext: 'zip'; mime: string; count: number }> {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    const r = await exportDesign(wasm, assets, d, {
      format: opts.format,
      orientation: opts.orientation,
      withBase: false,
      printer: opts.printer,
    });
    let name = `${String(i + 1).padStart(2, '0')}-${baseFileName(d)}.${r.ext}`;
    while (used.has(name)) name = name.replace(/(\.\w+)$/, '-x$1');
    used.add(name);
    files[name] = r.data;
    onProgress?.(i + 1, designs.length);
  }
  return {
    data: zipSync(files, { level: 6 }),
    ext: 'zip',
    mime: 'application/zip',
    count: designs.length,
  };
}
