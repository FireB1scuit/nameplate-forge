import { create } from 'zustand';
import { geometry } from '../geometry/client';
import type { Design } from '../state/schema';
import { designToHash } from '../state/url';

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
    toastTimer = setTimeout(() => set({ message: null }), 2600);
  },
}));

function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .slice(0, 40);
}

export function stlFileName(design: Design): string {
  const name = slug(design.text.line1) || 'blank';
  const edge = design.base.edge === 'vertical' ? '-mdf' : '';
  return `nameplate-${name}-${design.base.bottom[0]}mm${edge}.stl`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build at export quality in the worker and download a binary STL (plate in place, mm). */
export async function exportStl(design: Design): Promise<void> {
  const { stl, result } = await geometry().exportStl(design);
  download(new Blob([stl], { type: 'model/stl' }), stlFileName(design));
  const kb = Math.round(stl.byteLength / 1024);
  useToast
    .getState()
    .show(
      result.stats.watertight
        ? `STL downloaded (${kb} KB, ${result.stats.triangles.toLocaleString()} triangles)`
        : `STL downloaded (${kb} KB), but the mesh check failed: ${result.stats.status}`,
    );
}

export function shareUrl(design: Design): string {
  const url = new URL(window.location.href);
  url.hash = designToHash(design);
  return url.href;
}

export async function copyShareLink(design: Design): Promise<void> {
  const link = shareUrl(design);
  try {
    await navigator.clipboard.writeText(link);
    useToast.getState().show('Link copied. It contains the whole design.');
  } catch {
    // clipboard can be blocked (permissions / insecure context): show the link instead
    window.prompt('Copy this link:', link);
  }
}
