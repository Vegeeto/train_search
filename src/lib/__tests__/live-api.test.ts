// @vitest-environment node
/**
 * Contract tests against the real FGC API. Opt-in: `npm run test:live`.
 * They pin the assumptions the app is built on (see docs/api-integration.md).
 */
import { describe, expect, it } from 'vitest';
import { departuresFrom } from '../departures';
import { directJourneys } from '../journeys';
import { fetchLiveTrains } from '../live';
import { fetchStations } from '../stations';
import { formatClock } from '../time';
import { TimetableCache } from '../timetable';

const run = process.env.RUN_LIVE_TESTS ? describe : describe.skip;

run('FGC live API', () => {
  const cache = new TimetableCache();

  it('lists every station, each with a unique two-letter-style code and coordinates', async () => {
    const stations = await fetchStations();
    expect(stations.length).toBeGreaterThan(90);
    expect(new Set(stations.map((s) => s.code)).size).toBe(stations.length);
    for (const s of stations) {
      expect(s.code).toMatch(/^[A-Z0-9]{1,4}$/);
      expect(Number.isFinite(s.lat) && Number.isFinite(s.lon)).toBe(true);
      expect(s.lines.length).toBeGreaterThan(0);
    }
    const names = new Map(stations.map((s) => [s.name, s.code]));
    expect(names.get('Barcelona - Plaça Catalunya')).toBe('PC');
    expect(names.get('Barcelona - Plaça Espanya')).toBe('PE');
    expect(names.get('Terrassa Nacions Unides')).toBe('NA');
    // Every headsign must resolve to a station, or live matching can't work.
    const rows = await cache.get(['Barcelona - Plaça Catalunya', 'Barcelona - Plaça Espanya', 'Lleida']);
    for (const r of rows) expect(names.has(r.headsign), r.headsign).toBe(true);
  }, 30_000);

  it('returns a full day at the busiest station in one export', async () => {
    const rows = await cache.get(['Barcelona - Plaça Catalunya']);
    expect(rows.length).toBeGreaterThan(300);
    const lines = new Set(rows.map((r) => r.line));
    for (const l of ['S1', 'S2', 'L6', 'L7']) expect(lines).toContain(l);
    expect(departuresFrom(rows, 'Barcelona - Plaça Catalunya').length).toBeGreaterThan(150);
  }, 30_000);

  // [from, to, plausible median ride in minutes] — ranges from FGC's published journey times.
  const pairs: [string, string, [number, number]][] = [
    ['Barcelona - Plaça Catalunya', 'Sarrià', [8, 16]],
    ['Sant Cugat Centre', 'Barcelona - Plaça Catalunya', [18, 32]],
    ['Barcelona - Plaça Catalunya', 'Sabadell Parc del Nord', [45, 70]],
    ['Barcelona - Plaça Espanya', 'Manresa-Baixador', [60, 95]],
    ['Martorell Enllaç', 'Barcelona - Plaça Espanya', [20, 55]],
    ['Lleida', 'La Pobla de Segur', [80, 130]],
  ];

  for (const [a, b, [minRide, maxRide]] of pairs) {
    it(`pairs ${a} → ${b} with consistent ride times`, async () => {
      const rows = await cache.get([a, b]);
      const journeys = directJourneys(rows, a, b);
      expect(journeys.length).toBeGreaterThan(0);

      // Per line, ride times should cluster tightly; a mis-pairing shows up as an outlier.
      const byLine = new Map<string, number[]>();
      for (const j of journeys) byLine.set(j.stop.line, [...(byLine.get(j.stop.line) ?? []), j.duration]);
      const report: string[] = [];
      for (const [line, ds] of byLine) {
        ds.sort((x, y) => x - y);
        const median = ds[Math.floor(ds.length / 2)];
        report.push(`${line}: n=${ds.length} min=${ds[0] / 60} med=${median / 60} max=${ds.at(-1)! / 60}`);
        for (const d of ds) expect(Math.abs(d - median)).toBeLessThanOrEqual(Math.max(240, median * 0.3));
      }
      const all = journeys.map((j) => j.duration).sort((x, y) => x - y);
      const overall = all[Math.floor(all.length / 2)] / 60;
      expect(overall, `median ride ${overall} min`).toBeGreaterThanOrEqual(minRide);
      expect(overall, `median ride ${overall} min`).toBeLessThanOrEqual(maxRide);
      // Every departure is a real train: no two journeys share a departure or an arrival row.
      expect(new Set(journeys.map((j) => `${j.stop.stopId}${j.stop.departure}${j.stop.line}`)).size).toBe(journeys.length);
      expect(new Set(journeys.map((j) => `${j.arrival.stopId}${j.arrival.arrival}${j.arrival.line}`)).size).toBe(journeys.length);
      console.info(`${a} → ${b}: ${journeys.length} trips, first ${formatClock(journeys[0].stop.departure)}, last ${formatClock(journeys.at(-1)!.stop.departure)}\n  ${report.join('\n  ')}`);
    }, 30_000);
  }

  it('finds no direct trains between stations on different networks', async () => {
    const rows = await cache.get(['Sarrià', 'Manresa-Baixador']);
    expect(directJourneys(rows, 'Sarrià', 'Manresa-Baixador')).toEqual([]);
  }, 30_000);

  it('parses the live positioning feed into station codes the timetable knows', async () => {
    const [trains, stations] = await Promise.all([fetchLiveTrains(), fetchStations()]);
    const codes = new Set(stations.map((s) => s.code));
    // The feed can legitimately be empty at night.
    for (const t of trains) {
      expect(t.id).toBeTruthy();
      if (t.destCode) expect(codes, `dest ${t.destCode}`).toContain(t.destCode);
      for (const s of t.nextStops) expect(codes, `next ${s}`).toContain(s);
    }
    console.info(`live trains: ${trains.length}, with occupancy: ${trains.filter((t) => t.occupancy).length}, late: ${trains.filter((t) => t.onTime === false).length}`);
  }, 30_000);
});
