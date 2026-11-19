import { exportUrl, fetchJson } from './api';
import { normalizeColor, readableTextColor } from './colors';
import type { Line, Station } from './types';

interface StationGroupRow {
  stop_name: string;
  parent_station: string | null;
  stop_id: string;
  route_short_name: string;
  route_color: string | null;
  lat: number | null;
  lon: number | null;
  wb: number | null;
}

/**
 * Station code: GTFS parent_station (`PC`), or — for the one station whose parent is null
 * in the feed (Terrassa Nacions Unides, `NA1`/`NA2`) — the stop_id minus its platform digits.
 * These codes are the same ones the live positioning feed uses.
 */
export function stationCode(parent: string | null | undefined, stopId: string): string {
  const p = parent?.trim();
  if (p) return p.toUpperCase();
  return stopId.trim().toUpperCase().replace(/\d+$/, '');
}

export function compareLines(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

export function buildStations(rows: StationGroupRow[]): Station[] {
  const byName = new Map<string, { codes: Map<string, number>; lat: number[]; lon: number[]; lines: Map<string, Line>; accessible: boolean }>();

  for (const row of rows) {
    if (!row.stop_name) continue;
    let entry = byName.get(row.stop_name);
    if (!entry) {
      entry = { codes: new Map(), lat: [], lon: [], lines: new Map(), accessible: false };
      byName.set(row.stop_name, entry);
    }
    const code = stationCode(row.parent_station, row.stop_id);
    entry.codes.set(code, (entry.codes.get(code) ?? 0) + 1);
    if (typeof row.lat === 'number' && typeof row.lon === 'number') {
      entry.lat.push(row.lat);
      entry.lon.push(row.lon);
    }
    if (row.route_short_name && !entry.lines.has(row.route_short_name)) {
      const color = normalizeColor(row.route_color);
      entry.lines.set(row.route_short_name, { name: row.route_short_name, color, textColor: readableTextColor(color) });
    }
    if ((row.wb ?? 0) >= 1) entry.accessible = true;
  }

  const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);

  return [...byName.entries()]
    .map(([name, e]) => ({
      // Most frequent code wins if a station ever reports more than one.
      code: [...e.codes.entries()].sort((a, b) => b[1] - a[1])[0][0],
      name,
      lat: average(e.lat),
      lon: average(e.lon),
      lines: [...e.lines.values()].sort((a, b) => compareLines(a.name, b.name)),
      accessible: e.accessible,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'));
}

/** Every station with service today, across the whole FGC network, in one request. */
export async function fetchStations(signal?: AbortSignal): Promise<Station[]> {
  const rows = await fetchJson<StationGroupRow[]>(
    exportUrl('viajes-de-hoy', {
      group_by: 'stop_name,parent_station,stop_id,route_short_name,route_color',
      select:
        'stop_name,parent_station,stop_id,route_short_name,route_color,avg(stop_lat) as lat,avg(stop_lon) as lon,max(wheelchair_boarding) as wb',
    }),
    { signal },
  );
  return buildStations(rows);
}
