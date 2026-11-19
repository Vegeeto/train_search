import { exportUrl, fetchJson, quote } from './api';
import { normalizeColor, readableTextColor } from './colors';
import { parseGtfsTime } from './time';
import type { StopTime } from './types';

interface StopTimeRow {
  date: string | null;
  stop_name: string;
  stop_id: string;
  route_short_name: string;
  route_color: string | null;
  trip_headsign: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: number | null;
  shape_id: number | null;
  platform_code: number | string | null;
}

const FIELDS =
  'date,stop_name,stop_id,route_short_name,route_color,trip_headsign,arrival_time,departure_time,stop_sequence,shape_id,platform_code';

function formatPlatform(value: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : String(value);
}

export function toStopTime(row: StopTimeRow): StopTime | null {
  const arrival = parseGtfsTime(row.arrival_time);
  const departure = parseGtfsTime(row.departure_time);
  if (Number.isNaN(arrival) && Number.isNaN(departure)) return null;
  const color = normalizeColor(row.route_color);
  return {
    date: (row.date ?? '').slice(0, 10),
    stationName: row.stop_name,
    stopId: row.stop_id,
    line: row.route_short_name,
    color,
    textColor: readableTextColor(color),
    headsign: row.trip_headsign,
    arrival: Number.isNaN(arrival) ? departure : arrival,
    departure: Number.isNaN(departure) ? arrival : departure,
    sequence: row.stop_sequence ?? 0,
    shapeId: row.shape_id ?? 0,
    platform: formatPlatform(row.platform_code),
  };
}

/**
 * The full day of scheduled stops at the given stations. The timetable for a service day
 * doesn't change minute to minute, so each station's day is fetched once and cached;
 * asking for [A, B] after [A] only downloads B.
 */
export class TimetableCache {
  private readonly entries = new Map<string, { rows: StopTime[]; fetchedAt: number }>();
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly ttlMs = 30 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private fresh(name: string): boolean {
    const entry = this.entries.get(name);
    return !!entry && this.now() - entry.fetchedAt < this.ttlMs;
  }

  async get(stationNames: string[], signal?: AbortSignal): Promise<StopTime[]> {
    const names = [...new Set(stationNames)];
    const missing = names.filter((n) => !this.fresh(n) && !this.inflight.has(n));

    if (missing.length) {
      const where =
        missing.length === 1 ? `stop_name=${quote(missing[0])}` : `stop_name in (${missing.map(quote).join(',')})`;
      // Not tied to the caller's signal: a cancelled view shouldn't waste a shared download.
      const request = fetchJson<StopTimeRow[]>(exportUrl('viajes-de-hoy', { where, select: FIELDS })).then((rows) => {
        const grouped = new Map<string, StopTime[]>(missing.map((n) => [n, []]));
        for (const row of rows) {
          const stop = toStopTime(row);
          if (stop) grouped.get(stop.stationName)?.push(stop);
        }
        const fetchedAt = this.now();
        for (const [name, list] of grouped) this.entries.set(name, { rows: list, fetchedAt });
      });
      const settled = request.finally(() => missing.forEach((n) => this.inflight.delete(n)));
      missing.forEach((n) => this.inflight.set(n, settled));
    }

    await Promise.all(names.map((n) => this.inflight.get(n)).filter(Boolean));
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return names.flatMap((n) => this.entries.get(n)?.rows ?? []);
  }

  clear(): void {
    this.entries.clear();
  }
}

export const timetable = new TimetableCache();
