import { useCallback, useRef, useState } from 'react';
import { loadPrefs, savePrefs, type Prefs } from '../lib/storage';

/** Cookie-backed preferences. Updates are written through immediately. */
export function usePrefs(): [Prefs, (update: (prev: Prefs) => Prefs) => void] {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const current = useRef(prefs);
  const update = useCallback((fn: (prev: Prefs) => Prefs) => {
    const next = fn(current.current);
    if (next === current.current) return;
    current.current = next;
    savePrefs(next);
    setPrefs(next);
  }, []);
  return [prefs, update];
}
