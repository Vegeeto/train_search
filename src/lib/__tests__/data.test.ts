import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../test/fixtures';
import { readableTextColor } from '../colors';
import { nearestStations } from '../geo';
import { buildStations, stationCode } from '../stations';
import { TimetableCache, toStopTime } from '../timetable';

const row = (over: Record<string, unknown> = {}) => ({
  date: '2026-11-19',
  stop_name: 'Sarrià',
  stop_id: 'SR1',
  route_short_name: 'S1',
  route_color: 'EF7900',
  trip_headsign: 'Barcelona - Plaça Catalunya',
  arrival_time: '08:00:00',
  departure_time: '08:00:30',
  stop_sequence: 15,
  shape_id: 200009,
  platform_code: 1.0,
  ...over,
});

describe('stations', () => {
  it('derives a code when parent_station is missing', () => {
    expect(stationCode('PC', 'PC1')).toBe('PC');
    expect(stationCode(null, 'NA2')).toBe('NA');
  });

  it('merges platforms and lines into one station', () => {
    const [st] = buildStations([
      { stop_name: 'Sarrià', parent_station: 'SR', stop_id: 'SR1', route_short_name: 'S1', route_color: 'EF7900', lat: 41.4, lon: 2.12, wb: 0 },
      { stop_name: 'Sarrià', parent_station: 'SR', stop_id: 'SR2', route_short_name: 'L6', route_color: '797FBC', lat: 41.402, lon: 2.122, wb: 1 },
      { stop_name: 'Sarrià', parent_station: 'SR', stop_id: 'SR2', route_short_name: 'S1', route_color: 'EF7900', lat: 41.402, lon: 2.122, wb: 0 },
    ]);
    expect(st).toMatchObject({ code: 'SR', name: 'Sarrià', accessible: true });
    expect(st.lines.map((l) => l.name)).toEqual(['L6', 'S1']);
    expect(st.lat).toBeCloseTo(41.4013, 3);
  });
});

describe('colours', () => {
  it('uses dark text on light line colours', () => {
    expect(readableTextColor('#b3b3b3')).toBe('#111111');
    expect(readableTextColor('#0a57a3')).toBe('#ffffff');
  });
});

describe('geo', () => {
  it('returns the closest stations first', () => {
    const near = nearestStations(
      [
        { code: 'A', name: 'Far', lat: 41.6, lon: 2.0, lines: [], accessible: false },
        { code: 'B', name: 'Near', lat: 41.401, lon: 2.121, lines: [], accessible: false },
        { code: 'C', name: 'No coords', lat: Number.NaN, lon: Number.NaN, lines: [], accessible: false },
      ],
      41.4,
      2.12,
    );
    expect(near.map((n) => n.station.code)).toEqual(['B', 'A']);
    expect(near[0].meters).toBeLessThan(200);
  });
});

describe('timetable', () => {
  it('normalises a row', () => {
    expect(toStopTime(row({ date: '2026-11-19T00:00:00+00:00', arrival_time: '24:10:00', departure_time: '24:10:30' }))).toMatchObject({
      date: '2026-11-19',
      arrival: 87_000,
      departure: 87_030,
      platform: '1',
      color: '#ef7900',
    });
    expect(toStopTime(row({ arrival_time: 'x', departure_time: 'y' }))).toBeNull();
  });

  it('caches per station and only downloads what is missing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([row()]))
      .mockResolvedValueOnce(jsonResponse([row({ stop_name: 'Gràcia', stop_id: 'GR1' })]));
    const cache = new TimetableCache();

    expect(await cache.get(['Sarrià'])).toHaveLength(1);
    expect(await cache.get(['Sarrià'])).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const both = await cache.get(['Sarrià', 'Gràcia']);
    expect(both.map((r) => r.stationName)).toEqual(['Sarrià', 'Gràcia']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const where = new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('where');
    expect(where).toBe("stop_name='Gràcia'");
  });

  it('can retry after a failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new TypeError('offline'));
    const cache = new TimetableCache();
    await expect(cache.get(['Sarrià'])).rejects.toThrow('offline');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([row()]));
    await expect(cache.get(['Sarrià'])).resolves.toHaveLength(1);
  });

  it('refetches after the TTL', async () => {
    let clock = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse([row()]));
    const cache = new TimetableCache(1000, () => clock);
    await cache.get(['Sarrià']);
    clock = 999;
    await cache.get(['Sarrià']);
    clock = 1001;
    await cache.get(['Sarrià']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
