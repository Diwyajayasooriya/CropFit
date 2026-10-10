'use client';
import { useEffect, useState } from 'react';

// The caller supplies a stable loader. Cancelled requests never replace a newer selection.
export function useResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setState({ data: null, error: null, loading: true });
      return loader();
    }).then(data => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch(error => { if (!cancelled) setState({ data: null, error: error instanceof Error ? error.message : 'Could not load data.', loading: false }); });
    return () => { cancelled = true; };
  }, [loader, version]);
  return { ...state, reload: () => setVersion(v => v + 1) };
}
