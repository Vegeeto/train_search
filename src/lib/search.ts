import type { Station } from './types';

/** Abbreviations that appear in station names, expanded on both sides of the comparison. */
const ALIASES: Record<string, string> = {
  pl: 'placa',
  pza: 'placa',
  plaza: 'placa',
  av: 'avinguda',
  avda: 'avinguda',
  avenida: 'avinguda',
  st: 'sant',
  sta: 'santa',
  san: 'sant',
  bcn: 'barcelona',
  univ: 'universitat',
  universidad: 'universitat',
};

/** Lowercase, strip accents (`Plaça` → `placa`, `l·l` → `ll`), punctuation to spaces. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/·/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
    .map((t) => ALIASES[t] ?? t);
}

/** Relevance of a station for a query; 0 means no match. */
export function scoreStation(station: Station, query: string): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const name = tokens(station.name);
  const joinedName = name.join(' ');
  const joinedQuery = q.join(' ');

  if (q.length === 1 && q[0] === station.code.toLowerCase()) return 100;
  if (joinedName === joinedQuery) return 95;

  // Every query word must be the start of some word in the name (any order).
  const used = new Set<number>();
  let positionPenalty = 0;
  for (const word of q) {
    const index = name.findIndex((n, i) => !used.has(i) && n.startsWith(word));
    if (index === -1) {
      return joinedName.includes(joinedQuery) ? 30 : 0;
    }
    used.add(index);
    positionPenalty += index;
  }
  // Prefer names that start with the query, then fewer extra words, then earlier matches.
  const startsWith = joinedName.startsWith(joinedQuery) ? 20 : 0;
  return 60 + startsWith - positionPenalty - (name.length - q.length);
}

export function searchStations(stations: Station[], query: string, limit = 8): Station[] {
  return stations
    .map((station) => ({ station, score: scoreStation(station, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name, 'ca'))
    .slice(0, limit)
    .map((r) => r.station);
}
