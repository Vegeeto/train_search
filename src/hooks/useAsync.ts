import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown; data?: T };

/**
 * Run `load` whenever `key` changes. Superseded runs are aborted and their results
 * discarded, so a slow response for an old selection can never overwrite a newer one.
 * `key === null` means "nothing to load".
 */
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: key === null ? 'idle' : 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (key === null) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({ status: 'loading', data: 'data' in prev ? prev.data : undefined }));
    loadRef.current(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ status: 'ready', data }),
      (error) => !controller.signal.aborted && setState({ status: 'error', error }),
    );
    return () => controller.abort();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
