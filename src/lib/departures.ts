import type { Departure, StopTime } from './types';

/** A train whose headsign is this very station ends here: an arrival, not a departure. */
export function terminatesAt(stop: StopTime, stationName: string): boolean {
  return stop.headsign === stationName;
}

/** All of today's departures from a station, earliest first, with last-of-day flags. */
export function departuresFrom(rows: StopTime[], stationName: string): Departure[] {
  const list = rows
    .filter((r) => r.stationName === stationName && !terminatesAt(r, stationName))
    .sort((a, b) => a.departure - b.departure || a.line.localeCompare(b.line));

  const last = new Map<string, number>();
  for (const r of list) last.set(`${r.line}|${r.headsign}`, r.departure);

  return list.map((stop) => ({ stop, isLast: last.get(`${stop.line}|${stop.headsign}`) === stop.departure }));
}
