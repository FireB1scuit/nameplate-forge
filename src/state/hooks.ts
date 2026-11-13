import { useEffect, useState } from 'react';
import { geometry } from '../geometry/client';
import { useStore } from './store';
import { designFromHash, designToHash, diff } from './url';
import { DEFAULT_DESIGN } from './schema';

const BUILD_DEBOUNCE_MS = 100;

/**
 * Live rebuild (plan.md §5.6): debounce design changes, send them to the worker, and drop any
 * result that is older than the latest request.
 */
export function useLiveBuild(): void {
  useEffect(() => {
    let latestId = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const request = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const id = ++latestId;
        const { design, setBuild } = useStore.getState();
        setBuild({ status: 'building' });
        geometry()
          .build(id, design)
          .then((result) => {
            if (result.id !== latestId) return; // stale
            setBuild({ status: 'ready', result, error: null });
          })
          .catch((err: unknown) => {
            if (id !== latestId) return;
            console.error(err);
            setBuild({ status: 'error', error: err instanceof Error ? err.message : String(err) });
          });
      }, BUILD_DEBOUNCE_MS);
    };

    request();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.design !== prev.design) request();
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
}

/** Keep the URL hash in sync with the design, and load designs pasted into the address bar. */
export function useHashSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { design } = useStore.getState();
        const isDefault = diff(design, DEFAULT_DESIGN) === undefined;
        const url = new URL(window.location.href);
        url.hash = isDefault ? '' : designToHash(design);
        if (url.href !== window.location.href) {
          window.history.replaceState(null, '', isDefault ? url.pathname + url.search : url.href);
        }
      }, 300);
    };
    const unsub = useStore.subscribe((s, prev) => {
      if (s.design !== prev.design) write();
    });
    const onHash = () => {
      const d = designFromHash(window.location.hash);
      if (d) useStore.getState().setDesign(d);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      unsub();
      clearTimeout(timer);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export const PHONE_QUERY = '(max-width: 767px)';
