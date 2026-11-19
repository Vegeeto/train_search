import { exportUrl, fetchJson } from './api';
import type { LiveStatus, LiveTrain, Occupancy, OccupancyLevel, StopTime } from './types';

interface PositionRow {
  id: string;
  lin: string | null;
  desti: string | null;
  properes_parades: string | null;
  estacionat_a: string | null;
  en_hora: string | null;
  [key: string]: unknown;
}

/** `{"parada": "GR"};{"parada": "PC"}` → `['GR', 'PC']`. Tolerant of spacing and junk. */
export function parseNextStops(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(/"parada"\s*:\s*"([^"]+)"/g)].map((m) => m[1].trim().toUpperCase());
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toLevel(value: unknown): OccupancyLevel | null {
  const n = toNumber(value);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** Cars appear as `ocupacio_<car>_percent` / `ocupacio_<car>_tram` (1 low, 2 medium, 3 high). */
export function parseOccupancy(row: Record<string, unknown>): Occupancy | null {
  const cars = new Map<string, { percent: number | null; level: OccupancyLevel | null }>();
  for (const [key, value] of Object.entries(row)) {
    const m = /^ocupacio_(.+)_(percent|tram)$/.exec(key);
    if (!m) continue;
    const car = cars.get(m[1]) ?? { percent: null, level: null };
    if (m[2] === 'percent') car.percent = toNumber(value);
    else car.level = toLevel(value);
    cars.set(m[1], car);
  }
  const readings = [...cars.values()].filter((c) => c.percent !== null || c.level !== null);
  if (!readings.length) return null;
  const levels = readings.map((c) => c.level).filter((l): l is OccupancyLevel => l !== null);
  const percents = readings.map((c) => c.percent).filter((p): p is number => p !== null);
  return {
    cars: readings,
    level: levels.length ? (Math.max(...levels) as OccupancyLevel) : null,
    percent: percents.length ? Math.max(...percents) : null,
  };
}

export function toLiveTrain(row: PositionRow): LiveTrain {
  const onTime = row.en_hora?.toLowerCase();
  return {
    id: row.id,
    line: (row.lin ?? '').trim().toUpperCase(),
    destCode: row.desti?.trim().toUpperCase() || null,
    nextStops: parseNextStops(row.properes_parades),
    atStation: row.estacionat_a?.trim().toUpperCase() || null,
    onTime: onTime === 'true' ? true : onTime === 'false' ? false : null,
    occupancy: parseOccupancy(row),
  };
}

export async function fetchLiveTrains(signal?: AbortSignal): Promise<LiveTrain[]> {
  const rows = await fetchJson<PositionRow[]>(exportUrl('posicionament-dels-trens', {}), { signal, timeoutMs: 10_000 });
  return rows.map(toLiveTrain);
}

/**
 * Line names differ between the live feed and the timetable (live `R61` runs as timetable
 * `R6`/`R60`), so compare by letter prefix + first digit. Rack/funicular codes (`M1` vs
 * `MM`) never match and fall back to destination-only matching.
 */
export function lineFamily(line: string): string {
  const m = /^([A-Z]+)(\d)?/.exec(line.toUpperCase());
  return m ? m[1] + (m[2] ?? '') : line.toUpperCase();
}

interface Approaching {
  train: LiveTrain;
  stopsAway: number;
}

/** How far a live train is from a station, or null if it isn't heading there. */
export function approachTo(train: LiveTrain, stationCode: string): Approaching | null {
  if (train.destCode === stationCode) return null; // it terminates here: never a departure
  if (train.atStation === stationCode) return { train, stopsAway: 0 };
  const index = train.nextStops.indexOf(stationCode);
  return index === -1 ? null : { train, stopsAway: index + 1 };
}

const MIN = 60;

/**
 * Attach live trains to scheduled departures from one station.
 *
 * Trains heading through the station toward the departure's destination are assigned to
 * the earliest free departure, nearest train first, within plausible time bounds for how
 * many stops away they are. A late train may claim a slot whose scheduled time has passed.
 * Items are returned as new objects; unmatched items keep no live status.
 */
export function attachLive<T extends { stop: StopTime; live?: LiveStatus }>(
  items: T[],
  stationCode: string,
  trains: LiveTrain[],
  codeByName: Map<string, string>,
  now: number,
): T[] {
  const result = items.map((item) => ({ ...item, live: undefined }) as T);
  const approaching = trains
    .map((t) => approachTo(t, stationCode))
    .filter((a): a is Approaching => a !== null)
    .sort((a, b) => a.stopsAway - b.stopsAway);

  const order = result.map((_, i) => i).sort((a, b) => result[a].stop.departure - result[b].stop.departure);
  const taken = new Set<number>();

  const fits = (item: T, a: Approaching, strictLine: boolean) => {
    const { stop } = item;
    if (codeByName.get(stop.headsign) !== a.train.destCode) return false;
    if (strictLine && lineFamily(stop.line) !== lineFamily(a.train.line)) return false;
    const lead = stop.departure - now;
    const late = a.train.onTime === false;
    if (lead < (late ? -20 * MIN : -2 * MIN)) return false;
    if (lead > a.stopsAway * 5 * MIN + 10 * MIN) return false;
    if (!late && lead < a.stopsAway * MIN - 5 * MIN) return false;
    return true;
  };

  for (const a of approaching) {
    const pick =
      order.find((i) => !taken.has(i) && fits(result[i], a, true)) ??
      order.find((i) => !taken.has(i) && fits(result[i], a, false));
    if (pick === undefined) continue;
    taken.add(pick);
    result[pick].live = {
      trainId: a.train.id,
      stopsAway: a.stopsAway,
      onTime: a.train.onTime,
      occupancy: a.train.occupancy,
    };
  }
  return result;
}
