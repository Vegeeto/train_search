import { useCallback, useEffect, useRef, useState } from 'react';

/** What the screen shows, mirrored in the URL (`?from=PC&to=SR&at=08:30`) so it can be shared. */
export interface Selection {
  from: string | null;
  to: string | null;
  /** `HH:MM`, or null for "now". */
  at: string | null;
}

const CODE = /^[A-Z0-9]{1,4}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseSelection(search: string): Selection {
  const params = new URLSearchParams(search);
  const code = (key: string) => {
    const v = params.get(key)?.toUpperCase() ?? null;
    return v && CODE.test(v) ? v : null;
  };
  const at = params.get('at');
  const from = code('from');
  const to = code('to');
  return { from, to: from && to !== from ? to : null, at: at && TIME.test(at) ? at : null };
}

export function selectionToSearch(s: Selection): string {
  const params = new URLSearchParams();
  if (s.from) params.set('from', s.from);
  if (s.from && s.to) params.set('to', s.to);
  if (s.at) params.set('at', s.at);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useUrlState(): [Selection, (patch: Partial<Selection>) => void] {
  const [selection, setSelection] = useState(() => parseSelection(window.location.search));
  const current = useRef(selection);

  useEffect(() => {
    const onPop = () => {
      current.current = parseSelection(window.location.search);
      setSelection(current.current);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((patch: Partial<Selection>) => {
    const prev = current.current;
    const next = { ...prev, ...patch };
    if (!next.from || next.to === next.from) next.to = null;
    const search = selectionToSearch(next);
    if (search !== window.location.search) {
      const url = `${window.location.pathname}${search}${window.location.hash}`;
      // Station changes are navigation (Back returns to them); time tweaks are not.
      const isNavigation = next.from !== prev.from || next.to !== prev.to;
      window.history[isNavigation ? 'pushState' : 'replaceState'](null, '', url);
    }
    current.current = next;
    setSelection(next);
  }, []);

  return [selection, update];
}
