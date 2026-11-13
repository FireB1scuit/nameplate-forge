/**
 * App state (plan.md §5.7): the design (with undo/redo), viewer/UI flags and the latest
 * geometry build result.
 */
import { create } from 'zustand';
import type { BuildResponse } from '../geometry/worker';
import { DEFAULT_DESIGN, type Design } from './schema';
import { designFromHash } from './url';

export type CameraPreset = 'front' | 'side' | 'top' | 'iso' | 'fit';
export type MobileTab = 'base' | 'text' | 'style' | 'plate';

export interface UiState {
  showBase: boolean;
  wireframe: boolean;
  printer: 'resin' | 'fdm';
  mobileTab: MobileTab;
  /** last requested camera preset; `nonce` changes on every request so repeats re-trigger */
  camera: { preset: CameraPreset; nonce: number };
}

export interface BuildState {
  status: 'idle' | 'building' | 'ready' | 'error';
  result: BuildResponse | null;
  error: string | null;
}

interface HistoryState {
  past: Design[];
  future: Design[];
  /** coalesce rapid edits of the same control (e.g. slider drags) into one undo step */
  lastKey: string | null;
  lastAt: number;
}

export interface Store {
  design: Design;
  ui: UiState;
  build: BuildState;
  history: HistoryState;
  /** Apply a change to the design. `key` identifies the control for undo coalescing. */
  update: (recipe: (d: Design) => void, key?: string) => void;
  /** Replace the whole design (e.g. from a share link). Undoable. */
  setDesign: (d: Design) => void;
  undo: () => void;
  redo: () => void;
  setUi: (patch: Partial<Omit<UiState, 'camera'>>) => void;
  requestCamera: (preset: CameraPreset) => void;
  setBuild: (patch: Partial<BuildState>) => void;
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

function initialDesign(): Design {
  if (typeof window !== 'undefined') {
    const fromUrl = designFromHash(window.location.hash);
    if (fromUrl) return fromUrl;
  }
  return structuredClone(DEFAULT_DESIGN);
}

export const useStore = create<Store>()((set, get) => ({
  design: initialDesign(),
  ui: {
    showBase: true,
    wireframe: false,
    printer: 'resin',
    mobileTab: 'text',
    camera: { preset: 'front', nonce: 0 },
  },
  build: { status: 'idle', result: null, error: null },
  history: { past: [], future: [], lastKey: null, lastAt: 0 },

  update(recipe, key) {
    const { design, history } = get();
    const next = structuredClone(design);
    recipe(next);
    if (JSON.stringify(next) === JSON.stringify(design)) return;
    const now = Date.now();
    const coalesce = key != null && key === history.lastKey && now - history.lastAt < COALESCE_MS;
    set({
      design: next,
      history: {
        past: coalesce ? history.past : [...history.past, design].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: key ?? null,
        lastAt: now,
      },
    });
  },

  setDesign(d) {
    const { design, history } = get();
    if (JSON.stringify(d) === JSON.stringify(design)) return;
    set({
      design: d,
      history: {
        past: [...history.past, design].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: null,
        lastAt: 0,
      },
    });
  },

  undo() {
    const { design, history } = get();
    const prev = history.past[history.past.length - 1];
    if (!prev) return;
    set({
      design: prev,
      history: {
        past: history.past.slice(0, -1),
        future: [design, ...history.future],
        lastKey: null,
        lastAt: 0,
      },
    });
  },

  redo() {
    const { design, history } = get();
    const next = history.future[0];
    if (!next) return;
    set({
      design: next,
      history: {
        past: [...history.past, design],
        future: history.future.slice(1),
        lastKey: null,
        lastAt: 0,
      },
    });
  },

  setUi(patch) {
    set({ ui: { ...get().ui, ...patch } });
  },

  requestCamera(preset) {
    const { ui } = get();
    set({ ui: { ...ui, camera: { preset, nonce: ui.camera.nonce + 1 } } });
  },

  setBuild(patch) {
    set({ build: { ...get().build, ...patch } });
  },
}));
