/**
 * User preferences, kept in one first-party cookie (as requested) so favourites survive
 * across visits. Everything is stored as two-letter station codes to stay well under
 * the ~4 KB cookie limit, and is validated on read: the cookie is user-editable input.
 */

export type Lang = 'ca' | 'es' | 'en';
export const LANGS: Lang[] = ['ca', 'es', 'en'];

export interface Prefs {
  /** Favourite stations. */
  stations: string[];
  /** Favourite journeys as [from, to]. */
  journeys: [string, string][];
  /** Recent searches as [from, to | null], newest first. */
  recents: [string, string | null][];
  lang: Lang | null;
}

export const COOKIE_NAME = 'fgc_prefs';
const MAX_AGE_SECONDS = 400 * 24 * 3600; // the maximum browsers honour
const MAX_FAVOURITES = 20;
const MAX_RECENTS = 6;
const MAX_COOKIE_CHARS = 3800;

export const emptyPrefs = (): Prefs => ({ stations: [], journeys: [], recents: [], lang: null });

const CODE = /^[A-Z0-9]{1,4}$/;
const isCode = (v: unknown): v is string => typeof v === 'string' && CODE.test(v);

export function sanitizePrefs(raw: unknown): Prefs {
  const prefs = emptyPrefs();
  if (!raw || typeof raw !== 'object') return prefs;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.stations)) prefs.stations = [...new Set(r.stations.filter(isCode))].slice(0, MAX_FAVOURITES);
  if (Array.isArray(r.journeys)) {
    const seen = new Set<string>();
    for (const j of r.journeys) {
      if (Array.isArray(j) && isCode(j[0]) && isCode(j[1]) && j[0] !== j[1] && !seen.has(`${j[0]}>${j[1]}`)) {
        seen.add(`${j[0]}>${j[1]}`);
        prefs.journeys.push([j[0], j[1]]);
      }
    }
    prefs.journeys = prefs.journeys.slice(0, MAX_FAVOURITES);
  }
  if (Array.isArray(r.recents)) {
    prefs.recents = r.recents
      .filter((x): x is [string, string | null] => Array.isArray(x) && isCode(x[0]) && (x[1] === null || isCode(x[1])))
      .map((x): [string, string | null] => [x[0], x[1]])
      .slice(0, MAX_RECENTS);
  }
  if (typeof r.lang === 'string' && (LANGS as string[]).includes(r.lang)) prefs.lang = r.lang as Lang;
  return prefs;
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** Scope the cookie to the app's own directory (e.g. `/train_search/` on GitHub Pages). */
function cookiePath(): string {
  const path = window.location.pathname;
  return path.slice(0, path.lastIndexOf('/') + 1) || '/';
}

export function loadPrefs(): Prefs {
  try {
    const raw = readCookie(COOKIE_NAME);
    return raw ? sanitizePrefs(JSON.parse(decodeURIComponent(raw))) : emptyPrefs();
  } catch {
    return emptyPrefs(); // corrupt cookie: start clean rather than crash
  }
}

export function encodePrefs(prefs: Prefs): string {
  const trimmed: Prefs = { ...prefs, recents: [...prefs.recents], journeys: [...prefs.journeys] };
  let value = encodeURIComponent(JSON.stringify(trimmed));
  // Drop history first, then the oldest favourites, until it fits.
  while (value.length > MAX_COOKIE_CHARS && (trimmed.recents.length || trimmed.journeys.length)) {
    if (trimmed.recents.length) trimmed.recents.pop();
    else trimmed.journeys.pop();
    value = encodeURIComponent(JSON.stringify(trimmed));
  }
  return value;
}

export function savePrefs(prefs: Prefs): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=${encodePrefs(prefs)}; Max-Age=${MAX_AGE_SECONDS}; Path=${cookiePath()}; SameSite=Lax${secure}`;
  } catch {
    // Cookies disabled: preferences just won't persist.
  }
}

// Pure updaters, so components and tests share the exact same rules.

export function toggleStation(prefs: Prefs, code: string): Prefs {
  const has = prefs.stations.includes(code);
  return { ...prefs, stations: has ? prefs.stations.filter((c) => c !== code) : [code, ...prefs.stations].slice(0, MAX_FAVOURITES) };
}

export function hasJourney(prefs: Prefs, from: string, to: string): boolean {
  return prefs.journeys.some(([a, b]) => a === from && b === to);
}

export function toggleJourney(prefs: Prefs, from: string, to: string): Prefs {
  const journeys = hasJourney(prefs, from, to)
    ? prefs.journeys.filter(([a, b]) => !(a === from && b === to))
    : ([[from, to], ...prefs.journeys] as [string, string][]).slice(0, MAX_FAVOURITES);
  return { ...prefs, journeys };
}

export function addRecent(prefs: Prefs, from: string, to: string | null): Prefs {
  const rest = prefs.recents.filter(([a, b]) => !(a === from && b === to));
  return { ...prefs, recents: ([[from, to], ...rest] as [string, string | null][]).slice(0, MAX_RECENTS) };
}
