import * as Comlink from 'comlink';
import { create } from 'zustand';
import { registerUserFont, USER_PREFIX } from '../data/fonts';
import type { BatchOptions, ExportOptions } from '../geometry/exporter';
import { geometry } from '../geometry/client';
import { LEGACY_DEFAULTS, sanitizeDesign, usesUserAssets, type Design } from '../state/schema';
import { useStore } from '../state/store';
import { designToHash, merge } from '../state/url';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useToast = create<ToastState>()((set) => ({
  message: null,
  show(message) {
    clearTimeout(toastTimer);
    set({ message });
    toastTimer = setTimeout(() => set({ message: null }), 3200);
  },
}));
const toast = (m: string) => useToast.getState().show(m);

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

export function fileStem(design: Design): string {
  const b = design.base;
  const size =
    b.shape === 'oval' || b.shape === 'rect' ? `${b.bottom[0]}x${b.bottom[1]}` : `${b.bottom[0]}`;
  const edge = b.edge === 'vertical' ? '-mdf' : '';
  return `nameplate-${slug(design.text.line1)}-${size}mm${edge}`;
}

/** Back-compat name used by tests and the old export button. */
export function stlFileName(design: Design): string {
  return `${fileStem(design)}.stl`;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const asBlob = (data: Uint8Array, mime: string) =>
  new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], {
    type: mime,
  });

/** Build at export quality in the worker and download (STL or 3MF). */
export async function exportFile(design: Design, opts: ExportOptions): Promise<void> {
  const r = await geometry().exportFile(design, opts);
  const suffix = opts.withBase ? '-with-base' : opts.orientation === 'flat' ? '-flat' : '';
  download(asBlob(r.data, r.mime), `${fileStem(design)}${suffix}.${r.ext}`);
  toast(
    `${r.ext.toUpperCase()} downloaded (${Math.round(r.data.byteLength / 1024)} KB, ${r.summary})`,
  );
}

/** Quick export with the last-used options. */
export async function exportStl(design: Design): Promise<void> {
  await exportFile(design, {
    format: 'stl',
    orientation: 'inplace',
    withBase: false,
    printer: useStore.getState().ui.printer,
  });
}

export async function exportBatchFile(
  designs: Design[],
  opts: BatchOptions,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const r = await geometry().exportBatch(designs, opts, Comlink.proxy(onProgress));
  const name = 'nameplates.zip';
  download(asBlob(r.data, r.mime), name);
  toast(`${name} downloaded (${r.summary}, ${Math.round(r.data.byteLength / 1024)} KB)`);
}

export function shareUrl(design: Design): string {
  const url = new URL(window.location.href);
  url.hash = designToHash(design);
  return url.href;
}

export async function copyShareLink(design: Design): Promise<void> {
  const link = shareUrl(design);
  const extra = usesUserAssets(design)
    ? ' Uploaded fonts/icons are not included: the link uses the defaults.'
    : '';
  try {
    await navigator.clipboard.writeText(link);
    toast(`Link copied. It contains the whole design.${extra}`);
  } catch {
    // clipboard can be blocked (permissions / insecure context): show the link instead
    window.prompt('Copy this link:', link);
  }
}

// ---------------------------------------------------------------------------------------------
// Uploads (fonts, SVG end-caps): parsed locally, never uploaded anywhere
// ---------------------------------------------------------------------------------------------

let uploadCount = 0;
const userIcons = new Map<string, string>();

export function userIconList(): Array<{ id: string; name: string }> {
  return [...userIcons].map(([id, name]) => ({ id, name }));
}
export const hasUserIcon = (id: string) => userIcons.has(id);

export async function uploadFont(file: File): Promise<string | null> {
  if (file.size > 15 * 1024 * 1024) {
    toast('That font file is over 15 MB');
    return null;
  }
  const buf = await file.arrayBuffer();
  const id = `${USER_PREFIX}font-${++uploadCount}`;
  try {
    const copy = buf.slice(0);
    const { name } = await geometry().registerFont(id, Comlink.transfer(copy, [copy]));
    const family = `NF User ${uploadCount}`;
    try {
      const face = new FontFace(family, buf);
      await face.load();
      document.fonts.add(face);
    } catch {
      /* preview falls back to the UI font */
    }
    registerUserFont(id, name, family);
    const { setUi, ui, update } = useStore.getState();
    setUi({ assetsVersion: ui.assetsVersion + 1 });
    update((d) => void (d.text.fontId = id), 'text.font');
    toast(`Font "${name}" loaded. It stays on this device.`);
    return id;
  } catch (e) {
    console.error(e);
    toast('Could not read that font (TTF or OTF needed)');
    return null;
  }
}

export async function uploadIcon(file: File): Promise<string | null> {
  if (file.size > 2 * 1024 * 1024) {
    toast('That SVG is over 2 MB');
    return null;
  }
  const text = await file.text();
  const id = `${USER_PREFIX}icon-${++uploadCount}`;
  const res = await geometry().registerIcon(id, text);
  if (!res.ok) {
    toast(res.warnings[0] ?? 'No usable shapes in that SVG');
    return null;
  }
  userIcons.set(id, file.name.replace(/\.svg$/i, '').slice(0, 24));
  const { setUi, ui, update } = useStore.getState();
  setUi({ assetsVersion: ui.assetsVersion + 1 });
  update((d) => void (d.style.endCaps.icon = id), 'style.icon');
  toast(res.warnings.length ? `Icon loaded (${res.warnings.join('; ')})` : 'Icon loaded');
  return id;
}

// ---------------------------------------------------------------------------------------------
// Saved style presets (localStorage). A preset is the whole design minus the text lines.
// ---------------------------------------------------------------------------------------------

export interface SavedPreset {
  name: string;
  savedAt: number;
  /** the whole design (text lines are ignored when applying) */
  design?: unknown;
  /** older entries: a diff against the version-2 defaults */
  patch?: unknown;
}

const PRESETS_KEY = 'nf.presets.v1';

export function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter(
          (p): p is SavedPreset =>
            typeof p === 'object' && p !== null && typeof (p as SavedPreset).name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function storePresets(list: SavedPreset[]): boolean {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    return true;
  } catch {
    toast('Could not save: browser storage is blocked or full');
    return false;
  }
}

export function savePreset(name: string, design: Design): SavedPreset[] {
  const clean = structuredClone(design);
  clean.text.line1 = '';
  clean.text.line2 = '';
  const list = loadPresets().filter((p) => p.name !== name);
  list.unshift({ name: name.slice(0, 40), savedAt: Date.now(), design: clean });
  storePresets(list);
  return list;
}

export function deletePreset(name: string): SavedPreset[] {
  const list = loadPresets().filter((p) => p.name !== name);
  storePresets(list);
  return list;
}

/** Apply a preset's style and settings, keeping the current text. */
export function applyPreset(p: SavedPreset): void {
  const { design, setDesign } = useStore.getState();
  const raw = p.design ?? { ...(merge(LEGACY_DEFAULTS, p.patch) as object), v: 2 };
  const next = sanitizeDesign(raw, { hasIcon: hasUserIcon });
  next.text.line1 = design.text.line1;
  next.text.line2 = design.text.line2;
  setDesign(next);
  toast(`Applied "${p.name}"`);
}

// ---------------------------------------------------------------------------------------------
// Screenshot: the viewport registers a capture function here
// ---------------------------------------------------------------------------------------------

let capture: (() => Promise<Blob | null>) | null = null;
export function registerCapture(fn: (() => Promise<Blob | null>) | null) {
  capture = fn;
}
export async function screenshot(design: Design): Promise<void> {
  const blob = capture ? await capture() : null;
  if (!blob) {
    toast('Screenshot failed');
    return;
  }
  download(blob, `${fileStem(design)}.png`);
  toast('Screenshot saved');
}
