'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Retain last good data on refresh failure; consumers must label it stale.
export function usePollingResource<T>(loader: () => Promise<T>, delayMs = 30_000) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (cancelled || pending || document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      pending = true;
      try {
        const data = await loader();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (error) {
        if (!cancelled) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Could not refresh data.' }));
      } finally {
        pending = false;
        if (!cancelled) timer = setTimeout(run, delayMs);
      }
    };
    refresh.current = () => { void run(); };
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') void run();
    };
    void Promise.resolve().then(() => {
      if (!cancelled) { setState({ data: null, error: null, loading: true }); void run(); }
    });
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [loader, delayMs]);
  return { ...state, reload: useCallback(() => refresh.current(), []) };
}
