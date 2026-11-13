/// <reference lib="webworker" />
/**
 * Geometry Web Worker (plan.md §5.6). Exposed through Comlink.
 * Loads the manifold wasm once and the fonts on demand, then builds/exports plates.
 */
import * as Comlink from 'comlink';
import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
// Vite emits the .wasm as an asset and gives us its final URL (works in dev and in the build).
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { findFont } from '../data/fonts';
import type { Design } from '../state/schema';
import { writeBinaryStl } from '../export/stl';
import { buildPlate, type BuildResult, type FontProvider } from './build';
import { parseFont, type LoadedFont } from './text';

let wasmPromise: Promise<ManifoldToplevel> | null = null;
function getWasm(): Promise<ManifoldToplevel> {
  wasmPromise ??= Module({ locateFile: () => wasmUrl }).then((m) => {
    m.setup();
    return m;
  });
  return wasmPromise;
}

const fontCache = new Map<string, Promise<LoadedFont>>();
const fonts: FontProvider = {
  get(id) {
    let p = fontCache.get(id);
    if (!p) {
      const entry = findFont(id);
      if (!entry) return Promise.reject(new Error(`Unknown font: ${id}`));
      p = fetch(`${import.meta.env.BASE_URL}fonts/${entry.file}`)
        .then((r) => {
          if (!r.ok) throw new Error(`Font ${entry.file}: HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((buf) => parseFont(id, buf, entry.variation));
      p.catch(() => fontCache.delete(id));
      fontCache.set(id, p);
    }
    return p;
  },
};

export interface BuildResponse extends BuildResult {
  id: number;
}

const api = {
  /** Resolves once the wasm is loaded; returns a short description for diagnostics. */
  async init(): Promise<string> {
    await getWasm();
    return 'manifold-3d ready';
  },

  async build(id: number, design: Design): Promise<BuildResponse> {
    const res = await buildPlate(await getWasm(), fonts, design, 'preview');
    return Comlink.transfer({ id, ...res }, [res.mesh.positions.buffer, res.mesh.indices.buffer]);
  },

  /** Full-quality build written as a binary STL (plate in place on the base, mm). */
  async exportStl(
    design: Design,
  ): Promise<{ stl: ArrayBuffer; result: Omit<BuildResult, 'mesh'> }> {
    const res = await buildPlate(await getWasm(), fonts, design, 'export');
    const stl = writeBinaryStl(res.mesh.positions, res.mesh.indices);
    return Comlink.transfer(
      { stl, result: { stats: res.stats, fit: res.fit, warnings: res.warnings } },
      [stl],
    );
  },
};

export type GeometryApi = typeof api;

Comlink.expose(api);
