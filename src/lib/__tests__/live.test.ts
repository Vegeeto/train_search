import { describe, expect, it } from 'vitest';
import { stop, train } from '../../test/fixtures';
import { departuresFrom } from '../departures';
import { attachLive, lineFamily, parseNextStops, parseOccupancy, toLiveTrain } from '../live';
import { parseGtfsTime } from '../time';

const codes = new Map([
  ['Barcelona - Plaça Catalunya', 'PC'],
  ['Terrassa Nacions Unides', 'NA'],
  ['Barcelona - Plaça Espanya', 'PE'],
  ['Sarrià', 'SR'],
]);
const NOW = parseGtfsTime('08:00:00');

describe('feed parsing', () => {
  it('parses the next-stops pseudo-JSON list', () => {
    expect(parseNextStops('{"parada": "GR"};{"parada": "PR"};{"parada": "PC"}')).toEqual(['GR', 'PR', 'PC']);
    expect(parseNextStops('')).toEqual([]);
    expect(parseNextStops('garbage')).toEqual([]);
  });

  it('reads per-car occupancy and reports the fullest car', () => {
    const occ = parseOccupancy({
      ocupacio_mi_percent: '52',
      ocupacio_mi_tram: '2',
      ocupacio_m1_percent: '81',
      ocupacio_m1_tram: '3',
      ocupacio_m2_percent: null,
      ocupacio_m2_tram: null,
    });
    expect(occ).toMatchObject({ level: 3, percent: 81 });
    expect(occ?.cars).toHaveLength(2);
    expect(parseOccupancy({ lin: 'S1' })).toBeNull();
  });

  it('maps a raw row', () => {
    const t = toLiveTrain({
      id: 'x',
      lin: 's1',
      desti: 'PC',
      properes_parades: '{"parada": "GR"}',
      estacionat_a: 'SG',
      en_hora: 'False',
    });
    expect(t).toMatchObject({ line: 'S1', destCode: 'PC', nextStops: ['GR'], atStation: 'SG', onTime: false });
  });

  it('groups line variants across feeds', () => {
    expect(lineFamily('R61')).toBe(lineFamily('R6'));
    expect(lineFamily('R60')).toBe(lineFamily('R6'));
    expect(lineFamily('S1')).not.toBe(lineFamily('S2'));
  });
});

describe('attachLive', () => {
  const board = (...times: [string, Partial<Parameters<typeof stop>[0]>?][]) =>
    departuresFrom(
      times.map(([time, extra]) => stop({ stationName: 'Sarrià', at: time, ...extra })),
      'Sarrià',
    );

  it('assigns approaching trains to the earliest matching departures, nearest first', () => {
    const deps = board(['08:02:00'], ['08:08:00'], ['08:14:00']);
    const trains = [
      train({ id: 'far', nextStops: ['A', 'B', 'C', 'SR', 'PC'] }),
      train({ id: 'near', nextStops: ['SR', 'PC'] }),
    ];
    const result = attachLive(deps, 'SR', trains, codes, NOW);
    expect(result.map((d) => d.live?.trainId)).toEqual(['near', 'far', undefined]);
    expect(result[0].live?.stopsAway).toBe(1);
    expect(result[1].live?.stopsAway).toBe(4);
  });

  it('marks a train stopped at the station as at the platform', () => {
    const result = attachLive(board(['08:01:00']), 'SR', [train({ atStation: 'SR', nextStops: ['PC'] })], codes, NOW);
    expect(result[0].live?.stopsAway).toBe(0);
  });

  it('only matches trains heading to the departure’s destination', () => {
    const result = attachLive(board(['08:02:00']), 'SR', [train({ destCode: 'NA', nextStops: ['SR', 'NA'] })], codes, NOW);
    expect(result[0].live).toBeUndefined();
  });

  it('ignores trains that terminate at this station', () => {
    const result = attachLive(board(['08:02:00']), 'SR', [train({ destCode: 'SR', nextStops: ['SR'] })], codes, NOW);
    expect(result[0].live).toBeUndefined();
  });

  it('lets a late train claim a departure whose scheduled time has passed', () => {
    const deps = board(['07:50:00'], ['08:05:00']);
    const result = attachLive(deps, 'SR', [train({ onTime: false, nextStops: ['SR', 'PC'] })], codes, NOW);
    expect(result[0].live?.onTime).toBe(false);
    expect(result[1].live).toBeUndefined();
  });

  it('does not give an on-time train a long-gone slot', () => {
    const deps = board(['07:50:00'], ['08:03:00']);
    const result = attachLive(deps, 'SR', [train({ nextStops: ['SR', 'PC'] })], codes, NOW);
    expect(result[0].live).toBeUndefined();
    expect(result[1].live).toBeDefined();
  });

  it('prefers the same line family when two lines share a destination', () => {
    const deps = board(['08:03:00', { line: 'S1' }], ['08:04:00', { line: 'S2' }]);
    const result = attachLive(deps, 'SR', [train({ line: 'S2', nextStops: ['SR', 'PC'] })], codes, NOW);
    expect(result.map((d) => d.live?.trainId)).toEqual([undefined, 'T1']);
  });

  it('falls back to destination only when line names differ between feeds', () => {
    const deps = board(['08:03:00', { line: 'MM', headsign: 'Barcelona - Plaça Catalunya' }]);
    const result = attachLive(deps, 'SR', [train({ line: 'M1', nextStops: ['SR', 'PC'] })], codes, NOW);
    expect(result[0].live).toBeDefined();
  });

  it('rejects implausible pairings (a train one stop away for a departure in an hour)', () => {
    const result = attachLive(board(['09:00:00']), 'SR', [train({ nextStops: ['SR', 'PC'] })], codes, NOW);
    expect(result[0].live).toBeUndefined();
  });

  it('does not mutate its input', () => {
    const deps = board(['08:02:00']);
    attachLive(deps, 'SR', [train({ nextStops: ['SR'] , destCode: 'PC'})], codes, NOW);
    expect(deps[0].live).toBeUndefined();
  });
});
