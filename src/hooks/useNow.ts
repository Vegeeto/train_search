import { useEffect, useState } from 'react';
import { madridNow, type MadridNow } from '../lib/time';

/** Madrid wall-clock time, refreshed every `intervalMs` and when the tab becomes visible. */
export function useNow(intervalMs = 15_000): MadridNow {
  const [now, setNow] = useState(() => madridNow());
  useEffect(() => {
    const tick = () => setNow(madridNow());
    const id = setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
