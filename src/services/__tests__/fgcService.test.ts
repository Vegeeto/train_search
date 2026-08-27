import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTrains, fetchStations } from '../fgcService';
import { DIRECTIONS } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeOk = (data: object) => ({
  ok: true,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

const makeErr = (status: number, text: string) => ({
  ok: false,
  status,
  statusText: text,
  text: () => Promise.resolve(text),
});

const emptyTrains = makeOk({ total_count: 0, results: [] });

/** Decode the `where` param from the URL passed to the first fetch call. */
const whereOf = (mock: ReturnType<typeof vi.fn>, callIndex = 0): string => {
  const url = mock.mock.calls[callIndex][0] as string;
  return new URLSearchParams(url.split('?')[1]).get('where') ?? '';
};

/** Build a minimal FGCJourney fixture. */
const journey = (arrival: string, overrides = {}) => ({
  stop_id: 'ML2',
  stop_name: 'Molí Nou',
  arrival_time: arrival,
  departure_time: arrival,
  trip_headsign: 'Barcelona - Plaça Espanya',
  route_short_name: 'L8',
  route_color: 'FF6319',
  date: '2024-01-15',
  stop_lat: 41.3,
  stop_lon: 2.1,
  ...overrides,
});

// ─── fetchTrains ─────────────────────────────────────────────────────────────

describe('fetchTrains', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
    // Fix "now" to 10:30:00 so time-dependent WHERE clauses are deterministic
    vi.setSystemTime(new Date('2024-01-15T10:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses stop_name and excludes the terminal headsign at the terminal station, regardless of direction', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Barcelona - Plaça Espanya', DIRECTIONS.OUTBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("stop_name='Barcelona - Plaça Espanya'");
    expect(where).toContain("trip_headsign!='Barcelona - Plaça Espanya'");
    expect(where).not.toContain('stop_sequence');
  });

  it('uses stop_name and terminal headsign for INBOUND at a non-terminal station', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("stop_name='Molí Nou - Ciutat Cooperativa'");
    expect(where).toContain("trip_headsign='Barcelona - Plaça Espanya'");
  });

  it('excludes the terminal headsign for OUTBOUND at a non-terminal station', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.OUTBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("stop_name='Molí Nou - Ciutat Cooperativa'");
    expect(where).toContain("trip_headsign!='Barcelona - Plaça Espanya'");
  });

  it('escapes single quotes in the station name (ODSQL uses backslash-escaping)', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains("L'Hospitalet Av. Carrilet", DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("stop_name='L\\'Hospitalet Av. Carrilet'");
  });

  it('adds route_short_name IN clause when train types are selected', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, ['L8', 'R5'], undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("route_short_name in ('L8','R5')");
  });

  it('adds route_url like clause using the slug from the route URL', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, 'http://www.fgc.cat/cat/llobregat-anoia.asp', 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("route_url like '*llobregat-anoia*'");
  });

  it('matches on route_long_name instead of route_url when routeLongName is provided (Lleida-La Pobla has route_url=null)', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Lleida', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, 'http://www.fgc.cat/cat/lleida-la-pobla.asp', 'Lleida Pirineus', 'Lleida - La Pobla');
    const where = whereOf(mockFetch);
    expect(where).toContain("route_long_name='Lleida - La Pobla'");
    expect(where).not.toContain('route_url');
  });

  it('uses arrival_time like for the selected hour filter', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, '14', undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("arrival_time like '14:%'");
    // Must not include the two-hour window that live mode adds
    expect(where).not.toMatch(/arrival_time like '\d{2}:%' or/);
  });

  it('uses two like clauses (current + next hour) in live mode', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    // System time is 10:30 → current=10, next=11
    expect(where).toContain("arrival_time like '10:%'");
    expect(where).toContain("arrival_time like '11:%'");
  });

  it('throws on a non-OK API response so App.tsx can show an error message', async () => {
    mockFetch.mockResolvedValue(makeErr(503, 'Service Unavailable'));
    await expect(
      fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya')
    ).rejects.toThrow('API error: Service Unavailable');
  });

  it('throws on a network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya')
    ).rejects.toThrow('Failed to fetch');
  });

  it('paginates results client-side and returns the correct totalCount', async () => {
    // 10 journeys all after bufferTime (10:25), within the 10:xx window
    const journeys = Array.from({ length: 10 }, (_, i) =>
      journey(`10:${(30 + i).toString().padStart(2, '0')}:00`)
    );
    mockFetch.mockResolvedValue(makeOk({ total_count: 10, results: journeys }));

    const page0 = await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(page0.results).toHaveLength(5);
    expect(page0.totalCount).toBe(10);

    const page1 = await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 5, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(page1.results).toHaveLength(5);
  });

  it('marks a journey as is_last_train when it matches the last-train query result', async () => {
    const lastJourney = journey('23:55:00');
    // First call: main results; second call: last-train lookup
    mockFetch
      .mockResolvedValueOnce(makeOk({ total_count: 1, results: [lastJourney] }))
      .mockResolvedValueOnce(makeOk({ total_count: 1, results: [lastJourney] }));

    const { results } = await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, '23', undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results[0].is_last_train).toBe(true);
  });

  it('does not mark a journey as last train when it differs from the last-train result', async () => {
    const regular = journey('10:35:00');
    const last = journey('23:55:00');
    mockFetch
      .mockResolvedValueOnce(makeOk({ total_count: 1, results: [regular] }))
      .mockResolvedValueOnce(makeOk({ total_count: 1, results: [last] }));

    const { results } = await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results[0].is_last_train).toBeUndefined();
  });

  it('filters out journeys before bufferTime in live mode', async () => {
    // bufferTime = 10:25:00; these should be excluded
    const stale = [journey('10:20:00'), journey('10:23:00')];
    const fresh = [journey('10:26:00'), journey('10:35:00')];
    mockFetch.mockResolvedValue(makeOk({ total_count: 4, results: [...stale, ...fresh] }));

    const { results, totalCount } = await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 10, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(totalCount).toBe(2);
    expect(results.map(r => r.arrival_time)).toEqual(['10:26:00', '10:35:00']);
  });
});

// ─── fetchTrains: query construction edge cases ──────────────────────────────

describe('fetchTrains query construction', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('zero-pads a single-digit selected hour (the <select> emits "0".."23")', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, '0', undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(whereOf(mockFetch)).toContain("arrival_time like '00:%'");
  });

  it('wraps to 00 for the next hour at 23:xx', async () => {
    vi.setSystemTime(new Date('2024-01-15T23:10:00'));
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Molí Nou - Ciutat Cooperativa', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).toContain("arrival_time like '23:%'");
    expect(where).toContain("arrival_time like '00:%'");
  });

  it('escapes quotes in the terminal name, the route long name and the train types', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains("Sant Boi", DIRECTIONS.INBOUND, 5, 0, undefined, ["L'8"], undefined, "L'Hospitalet", "Line d'Or");
    const where = whereOf(mockFetch);
    expect(where).toContain("trip_headsign='L\\'Hospitalet'");
    expect(where).toContain("route_short_name in ('L\\'8')");
    expect(where).toContain("route_long_name='Line d\\'Or'");
  });

  it('omits the route clause entirely when neither routeUrl nor routeLongName is given', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const where = whereOf(mockFetch);
    expect(where).not.toContain('route_url');
    expect(where).not.toContain('route_long_name');
  });

  it('omits the route_short_name clause when the train type list is empty', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, undefined, [], undefined, 'Barcelona - Plaça Espanya');
    expect(whereOf(mockFetch)).not.toContain('route_short_name');
  });

  it('requests the API-maximum page size (the API rejects limit > 100)', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    const params = new URLSearchParams((mockFetch.mock.calls[0][0] as string).split('?')[1]);
    expect(Number(params.get('limit'))).toBeLessThanOrEqual(100);
    expect(params.get('order_by')).toBe('arrival_time asc');
  });

  it('queries the last train of the day without any time filter, newest first', async () => {
    mockFetch.mockResolvedValue(emptyTrains);
    await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, '14', undefined, undefined, 'Barcelona - Plaça Espanya');
    const lastTrainCall = mockFetch.mock.calls.find(call =>
      new URLSearchParams((call[0] as string).split('?')[1]).get('order_by') === 'arrival_time desc'
    );
    expect(lastTrainCall).toBeDefined();
    const params = new URLSearchParams((lastTrainCall![0] as string).split('?')[1]);
    expect(params.get('where')).not.toContain('arrival_time');
    expect(params.get('limit')).toBe('1');
  });
});

// ─── fetchTrains: result handling ────────────────────────────────────────────

describe('fetchTrains result handling', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retrieves every row when a window holds more than one API page', async () => {
    // The API caps `limit` at 100; a busy hub in a two-hour window can exceed it.
    const page1 = Array.from({ length: 100 }, (_, i) =>
      journey(`10:${(30 + Math.floor(i / 4)).toString().padStart(2, '0')}:00`)
    );
    const page2 = Array.from({ length: 20 }, () => journey('11:45:00'));
    mockFetch.mockImplementation((url: string) => {
      const params = new URLSearchParams(url.split('?')[1]);
      if (params.get('order_by') === 'arrival_time desc') {
        return Promise.resolve(makeOk({ total_count: 120, results: [] }));
      }
      const offset = Number(params.get('offset') ?? 0);
      return Promise.resolve(
        makeOk({ total_count: 120, results: offset === 0 ? page1 : page2 })
      );
    });

    const { totalCount } = await fetchTrains('Barcelona - Plaça Catalunya', DIRECTIONS.OUTBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Catalunya');
    expect(totalCount).toBe(120);
  });

  it('returns an empty page when the offset is past the end of the results', async () => {
    mockFetch.mockResolvedValue(makeOk({ total_count: 2, results: [journey('10:40:00'), journey('10:45:00')] }));
    const { results, totalCount } = await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 50, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results).toEqual([]);
    expect(totalCount).toBe(2);
  });

  it('keeps only the selected hour, discarding rows the API returned outside it', async () => {
    mockFetch.mockResolvedValue(makeOk({
      total_count: 3,
      results: [journey('13:59:00'), journey('14:00:00'), journey('14:59:00')],
    }));
    const { results } = await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 10, 0, '14', undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results.map(r => r.arrival_time)).toEqual(['14:00:00', '14:59:00']);
  });

  it('keeps the full 23:00-23:59 range for the last hour of the day', async () => {
    mockFetch.mockResolvedValue(makeOk({
      total_count: 2,
      results: [journey('23:00:00'), journey('23:59:00')],
    }));
    const { results } = await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 10, 0, '23', undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results.map(r => r.arrival_time)).toEqual(['23:00:00', '23:59:00']);
  });

  it('still returns results when the last-train lookup fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOk({ total_count: 1, results: [journey('10:40:00')] }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { results } = await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results).toHaveLength(1);
    expect(results[0].is_last_train).toBeUndefined();
  });

  it('keeps a journey arriving exactly at the buffer boundary', async () => {
    // bufferTime is now - 5min = 10:25:00
    mockFetch.mockResolvedValue(makeOk({ total_count: 1, results: [journey('10:25:00')] }));
    const { totalCount } = await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(totalCount).toBe(1);
  });

  it('handles HH:MM arrival times without a seconds component', async () => {
    mockFetch.mockResolvedValue(makeOk({ total_count: 1, results: [journey('10:40')] }));
    const { results } = await fetchTrains('Sant Boi', DIRECTIONS.INBOUND, 5, 0, undefined, undefined, undefined, 'Barcelona - Plaça Espanya');
    expect(results).toHaveLength(1);
  });
});

// ─── fetchStations ────────────────────────────────────────────────────────────

describe('fetchStations', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('constructs the where clause from the slug of the route URL', async () => {
    mockFetch.mockResolvedValue(makeOk({ results: [] }));
    await fetchStations('http://www.fgc.cat/cat/llobregat-anoia.asp');
    const url = mockFetch.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('where')).toContain("route_url like '*llobregat-anoia*'");
  });

  it('deduplicates stations by name and picks the lexicographically smallest stop_id', async () => {
    mockFetch.mockResolvedValue(makeOk({
      results: [
        { stop_id: 'ML3', stop_name: 'Molí Nou' },
        { stop_id: 'ML2', stop_name: 'Molí Nou' },
        { stop_id: 'ES',  stop_name: 'Plaça Espanya' },
      ],
    }));
    const stations = await fetchStations('http://www.fgc.cat/cat/llobregat-anoia.asp');
    const moliNou = stations.find(s => s.name === 'Molí Nou');
    expect(moliNou?.id).toBe('ML2');
    expect(stations.filter(s => s.name === 'Molí Nou')).toHaveLength(1);
  });

  it('returns stations sorted alphabetically by name', async () => {
    mockFetch.mockResolvedValue(makeOk({
      results: [
        { stop_id: 'SJ', stop_name: 'Sant Boi' },
        { stop_id: 'AL', stop_name: 'Almeda' },
        { stop_id: 'CO', stop_name: 'Cornellà Riera' },
      ],
    }));
    const stations = await fetchStations('http://www.fgc.cat/cat/llobregat-anoia.asp');
    expect(stations.map(s => s.name)).toEqual(['Almeda', 'Cornellà Riera', 'Sant Boi']);
  });

  it('returns an empty array when no stations are found', async () => {
    mockFetch.mockResolvedValue(makeOk({ results: [] }));
    const stations = await fetchStations('http://www.fgc.cat/cat/lleida-la-pobla.asp');
    expect(stations).toEqual([]);
  });

  it('matches on route_long_name instead of route_url when routeLongName is provided', async () => {
    mockFetch.mockResolvedValue(makeOk({ results: [] }));
    await fetchStations('http://www.fgc.cat/cat/lleida-la-pobla.asp', 'Lleida - La Pobla');
    const url = mockFetch.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('where')).toBe("route_long_name='Lleida - La Pobla'");
  });

  it('returns an empty array on a non-OK API response', async () => {
    mockFetch.mockResolvedValue(makeErr(500, 'Internal Server Error'));
    const stations = await fetchStations('http://www.fgc.cat/cat/llobregat-anoia.asp');
    expect(stations).toEqual([]);
  });

  it('returns an empty array on a network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const stations = await fetchStations('http://www.fgc.cat/cat/llobregat-anoia.asp');
    expect(stations).toEqual([]);
  });
});
