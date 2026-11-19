import { useEffect, useRef, useState } from 'react';
import { fetchLiveTrains } from '../lib/live';
import type { LiveTrain } from '../lib/types';

export interface LiveState {
  trains: LiveTrain[];
  updatedAt: Date | null;
  failed: boolean;
}

/**
 * Poll FGC's live positioning feed while `enabled` and the tab is visible.
 * A failed poll keeps the last good data and flags `failed`; the timetable still works.
 */
export function useLiveTrains(enabled: boolean, intervalMs = 30_000): LiveState {
  const [state, setState] = useState<LiveState>({ trains: [], updatedAt: null, failed: false });
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const poll = async () => {
      clearTimeout(timer);
      if (stopped) return;
      if (document.visibilityState === 'hidden') return; // resumes on visibilitychange
      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      try {
        const trains = await fetchLiveTrains(controller.signal);
        if (!controller.signal.aborted) setState({ trains, updatedAt: new Date(), failed: false });
      } catch {
        if (!controller.signal.aborted) setState((s) => ({ ...s, failed: true }));
      }
      if (!stopped) timer = setTimeout(poll, intervalMs);
    };

    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      inflight.current?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);

  return state;
}
