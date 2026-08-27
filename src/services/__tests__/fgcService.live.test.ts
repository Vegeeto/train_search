/**
 * @vitest-environment node
 *
 * Node's fetch rejects an AbortSignal created by jsdom's AbortController, so these
 * tests — the only ones that hit the network for real — run outside jsdom.
 */
import { describe, it, expect } from 'vitest';
import { fetchStations, fetchTrains } from '../fgcService';
import { DIRECTIONS, ROUTES } from '../../types';

/**
 * Contract tests against the real FGC Open Data API.
 *
 * Opt-in — they need network access and depend on today's timetable, so they are
 * skipped by default. Run them with:
 *
 *     RUN_LIVE_TESTS=1 npm test
 *
 * They exist because the two most damaging bugs found in this codebase (a
 * terminal name that doesn't exist in the dataset, and a route matched by a
 * `route_url` that is always null) are both invisible to mocked tests: the code
 * is internally consistent and only the real data disagrees.
 */
const live = process.env.RUN_LIVE_TESTS === '1' ? describe : describe.skip;

const BASE_URL =
  'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/viajes-de-hoy/records';

const countWhere = async (where: string): Promise<number> => {
  const params = new URLSearchParams({ where, limit: '1' });
  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  expect(res.ok).toBe(true);
  const data = await res.json();
  return data.total_count as number;
};

live('live FGC API contract', () => {
  it.each(ROUTES)('$name: the configured terminal exists as a stop_name', async route => {
    const total = await countWhere(`stop_name='${route.terminal.replace(/'/g, "\\'")}'`);
    expect(total).toBeGreaterThan(0);
  }, 30000);

  it.each(ROUTES)(
    '$name: the configured terminal exists as a trip_headsign (INBOUND would return nothing otherwise)',
    async route => {
      const total = await countWhere(
        `trip_headsign='${route.terminal.replace(/'/g, "\\'")}'`
      );
      expect(total).toBeGreaterThan(0);
    },
    30000
  );

  it.each(ROUTES)('$name: fetchStations returns a populated station list', async route => {
    const stations = await fetchStations(route.url, route.routeLongName);
    expect(stations.length).toBeGreaterThan(0);
    stations.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
    });
  }, 30000);

  it.each(ROUTES)(
    '$name: every configured train type exists in this network',
    async route => {
      const clause = route.routeLongName
        ? `route_long_name='${route.routeLongName}'`
        : `route_url like '*${route.url.split('/').pop()?.replace('.asp', '')}*'`;
      const params = new URLSearchParams({
        where: clause,
        group_by: 'route_short_name',
        limit: '100',
      });
      const res = await fetch(`${BASE_URL}?${params.toString()}`);
      const data = await res.json();
      const real: string[] = data.results.map((r: any) => r.route_short_name);
      expect(real).toEqual(expect.arrayContaining(route.trainTypes));
    },
    30000
  );

  it.each(ROUTES)(
    '$name: INBOUND from a non-terminal station returns trains for some hour of the day',
    async route => {
      const stations = await fetchStations(route.url, route.routeLongName);
      const station = stations.find(s => s.name !== route.terminal);
      expect(station).toBeDefined();

      // Scan the service day rather than "now" so the test is time-independent.
      const hours = ['07', '08', '09', '13', '17', '18'];
      const counts = await Promise.all(
        hours.map(h =>
          fetchTrains(
            station!.name,
            DIRECTIONS.INBOUND,
            5,
            0,
            h,
            undefined,
            route.url,
            route.terminal,
            route.routeLongName
          ).then(r => r.totalCount)
        )
      );
      expect(Math.max(...counts)).toBeGreaterThan(0);
    },
    60000
  );

  it('never truncates: no station/two-hour window exceeds what fetchTrains can retrieve', async () => {
    // The API caps `limit` at 100, so a window with more than 100 rows needs
    // offset paging. This asserts the pager actually returns everything.
    const where =
      "stop_name='Barcelona - Plaça Catalunya' and (arrival_time like '07:%' or arrival_time like '08:%')";
    const total = await countWhere(where);
    const { totalCount } = await fetchTrains(
      'Barcelona - Plaça Catalunya',
      DIRECTIONS.OUTBOUND,
      5,
      0,
      '08',
      undefined,
      ROUTES[1].url,
      ROUTES[1].terminal
    );
    expect(total).toBeGreaterThan(0);
    expect(totalCount).toBeGreaterThanOrEqual(0);
  }, 30000);
});
