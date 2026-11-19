import { useEffect, useState } from 'react';
import type { Theme } from '../lib/storage';
import { applyTheme, systemTheme } from '../lib/theme';

/**
 * Apply the saved theme (or follow the system when none is saved) and report the
 * theme actually on screen, so the toggle can show the right icon.
 */
export function useTheme(saved: Theme | null): Theme {
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => applyTheme(saved), [saved]);

  return saved ?? system;
}
