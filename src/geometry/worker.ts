/// <reference lib="webworker" />
/**
 * Geometry Web Worker (plan.md §5.6). Exposed through Comlink.
 * Loads the manifold wasm once and fonts/icons on demand, then builds and exports plates.
 * Uploaded fonts and SVGs are sent here as bytes and stay in memory only.
 */
import * as Comlink from 'comlink';
import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
// Vite emits the .wasm as an asset and gives us its final URL (works in dev and in the build).
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { findFont, isUserAsset } from '../data/fonts';
import { writeBinaryStl } from '../export/stl';
import type { Design } from '../state/schema';
import { buildPlate, type BuildResult, type FontProvider, type Printer } from './build';
import { iconFromSvg, type IconArt } from './endcaps';
import {
  exportBatch,
  exportDesign,
  planBatch,
  type BatchOptions,
  type BatchRow,
  type ExportOptions,
} from './exporter';
import { parseFont, type LoadedFont } from './text';

let wasmPromise: Promise<ManifoldToplevel> | null = null;
function getWasm(): Promise<ManifoldToplevel> {
  wasmPromise ??= Module({ locateFile: () => wasmUrl }).then((m) => {
    m.setup();
    return m;
  });
  return wasmPromise;
}

const BASE = import.meta.env.BASE_URL;
const fontCache = new Map<string, Promise<LoadedFont>>();
const iconCache = new Map<string, Promise<IconArt | null>>();

function fetchBytes(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.arrayBuffer();
  });
}

const assets: FontProvider = {
  get(id) {
    let p = fontCache.get(id);
    if (!p) {
      if (isUserAsset(id)) return Promise.reject(new Error('Uploaded font is no longer loaded'));
      const entry = findFont(id);
      if (!entry) return Promise.reject(new Error(`Unknown font: ${id}`));
      p = fetchBytes(`${BASE}fonts/${entry.file}`).then((buf) =>
        parseFont(id, buf, entry.variation),
      );
      p.catch(() => fontCache.delete(id));
      fontCache.set(id, p);
    }
    return p;
  },
  icon(id) {
    let p = iconCache.get(id);
    if (!p) {
      if (isUserAsset(id)) return Promise.resolve(null);
      p = fetch(`${BASE}endcaps/${id}.svg`)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`icon ${id}: HTTP ${r.status}`))))
        .then((txt) => iconFromSvg(id, txt));
      p.catch(() => iconCache.delete(id));
      iconCache.set(id, p);
    }
    return p;
  },
};

export interface BuildResponse extends BuildResult {
  id: number;
}

export interface FileResponse {
  data: Uint8Array;
  ext: string;
  mime: string;
  summary: string;
}

const api = {
  /** Resolves once the wasm is loaded; returns a short description for diagnostics. */
  async init(): Promise<string> {
    await getWasm();
    return 'manifold-3d ready';
  },

  async build(id: number, design: Design, printer: Printer = 'resin'): Promise<BuildResponse> {
    const res = await buildPlate(await getWasm(), assets, design, { quality: 'preview', printer });
    return Comlink.transfer({ id, ...res }, [res.mesh.positions.buffer, res.mesh.indices.buffer]);
  },

  /** Register an uploaded font (parsed here; never leaves the device). Returns its family name. */
  async registerFont(id: string, buffer: ArrayBuffer): Promise<{ name: string; glyphs: number }> {
    const lf = parseFont(id, buffer);
    fontCache.set(id, Promise.resolve(lf));
    const names = lf.font.names as unknown as Record<string, Record<string, string> | undefined>;
    const name = names.fullName?.en ?? names.fontFamily?.en ?? 'Uploaded font';
    return { name, glyphs: lf.font.glyphs.length };
  },

  /** Register an uploaded SVG end-cap. Returns its warnings (empty = fine). */
  async registerIcon(id: string, svgText: string): Promise<{ ok: boolean; warnings: string[] }> {
    const art = iconFromSvg(id, svgText);
    iconCache.set(id, Promise.resolve(art.shapes.length ? art : null));
    return { ok: art.shapes.length > 0, warnings: art.warnings };
  },

  /** Full-quality export: STL or 3MF, in place or flat, optionally with the base. */
  async exportFile(design: Design, opts: ExportOptions): Promise<FileResponse> {
    const r = await exportDesign(await getWasm(), assets, design, opts);
    const summary = r.stats.watertight
      ? `${r.stats.triangles.toLocaleString()} triangles`
      : `mesh check failed: ${r.stats.status}`;
    return Comlink.transfer({ data: r.data, ext: r.ext, mime: r.mime, summary }, [r.data.buffer]);
  },

  /** Back-compat: plate in place as binary STL. */
  async exportStl(design: Design): Promise<{ stl: ArrayBuffer }> {
    const res = await buildPlate(await getWasm(), assets, design, 'export');
    const stl = writeBinaryStl(res.mesh.positions, res.mesh.indices);
    return Comlink.transfer({ stl }, [stl]);
  },

  async planBatch(designs: Design[]): Promise<BatchRow[]> {
    return planBatch(assets, designs);
  },

  async exportBatch(
    designs: Design[],
    opts: BatchOptions,
    onProgress?: (done: number, total: number) => void,
  ): Promise<FileResponse> {
    const r = await exportBatch(await getWasm(), assets, designs, opts, onProgress);
    const summary = `${r.count} plate${r.count === 1 ? '' : 's'}`;
    return Comlink.transfer({ data: r.data, ext: r.ext, mime: r.mime, summary }, [r.data.buffer]);
  },
};

export type GeometryApi = typeof api;

Comlink.expose(api);
