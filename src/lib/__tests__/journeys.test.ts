import { describe, expect, it } from 'vitest';
import { stop } from '../../test/fixtures';
import { departuresFrom } from '../departures';
import { directJourneys } from '../journeys';
import { formatClock } from '../time';

const S1_DOWN = { line: 'S1', shapeId: 200009, headsign: 'Barcelona - Plaça Catalunya' };
const S1_UP = { line: 'S1', shapeId: 100009, headsign: 'Terrassa Nacions Unides' };

const at = (stationName: string, time: string, sequence: number, base = S1_DOWN) =>
  stop({ ...base, stationName, at: time, sequence, stopId: `${stationName}1` });

const summary = (rows: ReturnType<typeof directJourneys>) =>
  rows.map((j) => `${formatClock(j.stop.departure)}-${formatClock(j.arrival.arrival)}`);

describe('directJourneys', () => {
  it('pairs each departure with its own arrival downstream', () => {
    const rows = [
      at('Sant Cugat Centre', '08:00:00', 10),
      at('Sant Cugat Centre', '08:15:00', 10),
      at('Sarrià', '08:14:00', 15),
      at('Sarrià', '08:29:00', 15),
    ];
    const result = directJourneys(rows, 'Sant Cugat Centre', 'Sarrià');
    expect(summary(result)).toEqual(['08:00-08:14', '08:15-08:29']);
    expect(result.map((j) => j.duration)).toEqual([14 * 60, 14 * 60]);
    expect(result.at(-1)?.isLast).toBe(true);
  });

  it('ignores trains going the other way', () => {
    const rows = [
      at('Sant Cugat Centre', '08:00:00', 5, S1_UP),
      at('Sarrià', '07:45:00', 2, S1_UP),
      at('Sarrià', '08:20:00', 2, S1_UP),
    ];
    expect(directJourneys(rows, 'Sant Cugat Centre', 'Sarrià')).toEqual([]);
  });

  it('does not let one skipped stop shift every later pairing', () => {
    // The 08:10 train skips Sarrià: it must not steal the 08:29 arrival of the next train.
    const rows = [
      at('Sant Cugat Centre', '08:00:00', 10),
      at('Sant Cugat Centre', '08:10:00', 10),
      at('Sant Cugat Centre', '08:15:00', 10),
      at('Sant Cugat Centre', '08:30:00', 10),
      at('Sarrià', '08:14:00', 15),
      at('Sarrià', '08:29:00', 15),
      at('Sarrià', '08:44:00', 15),
    ];
    expect(summary(directJourneys(rows, 'Sant Cugat Centre', 'Sarrià'))).toEqual(['08:00-08:14', '08:15-08:29', '08:30-08:44']);
  });

  it('is not fooled when the ride is longer than the gap between trains', () => {
    // Every 6 minutes, 12-minute ride: the first arrival after each departure is the
    // previous train's, and a 12-minute ride is the right answer, not 6 or 0.
    const rows = [];
    for (let i = 0; i < 20; i++) {
      const dep = 7 * 60 + i * 6;
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
      rows.push(at('Barcelona - Plaça Catalunya', hhmm(dep), 1, S1_UP), at('Sarrià', hhmm(dep + 12), 8, S1_UP));
    }
    const result = directJourneys(rows, 'Barcelona - Plaça Catalunya', 'Sarrià');
    expect(result).toHaveLength(20);
    expect(new Set(result.map((j) => j.duration))).toEqual(new Set([12 * 60]));
  });

  it('separates trains from different origins by their stop sequence', () => {
    // Two trains start further back (seq 22 at A), one starts right before A (seq 2):
    // their arrival at B carries a matching sequence (31 vs 11).
    const rows = [
      at('Martorell Enllaç', '08:00:00', 22),
      at('Martorell Enllaç', '08:20:00', 2),
      at('Martorell Enllaç', '08:30:00', 22),
      at('Barcelona - Plaça Espanya', '08:24:00', 31),
      at('Barcelona - Plaça Espanya', '08:44:00', 11),
      at('Barcelona - Plaça Espanya', '08:54:00', 31),
    ];
    expect(summary(directJourneys(rows, 'Martorell Enllaç', 'Barcelona - Plaça Espanya'))).toEqual(['08:00-08:24', '08:20-08:44', '08:30-08:54']);
  });

  it('never departs from a station where the train terminates', () => {
    const rows = [
      stop({ stationName: 'Sarrià', headsign: 'Sarrià', line: 'L12', shapeId: 1, sequence: 2, at: '08:00:00' }),
      stop({ stationName: 'Reina Elisenda', headsign: 'Sarrià', line: 'L12', shapeId: 1, sequence: 1, at: '07:58:00' }),
    ];
    expect(directJourneys(rows, 'Sarrià', 'Reina Elisenda')).toEqual([]);
  });

  it('returns nothing for the same station', () => {
    expect(directJourneys([at('Sarrià', '08:00:00', 1)], 'Sarrià', 'Sarrià')).toEqual([]);
  });

  it('handles trains running past midnight', () => {
    const rows = [at('Sant Cugat Centre', '24:40:00', 10), at('Sarrià', '24:54:00', 15)];
    expect(summary(directJourneys(rows, 'Sant Cugat Centre', 'Sarrià'))).toEqual(['00:40-00:54']);
  });

  it('merges several lines and sorts by departure', () => {
    const s2 = { line: 'S2', shapeId: 200010, headsign: 'Barcelona - Plaça Catalunya' };
    const rows = [
      at('Sant Cugat Centre', '08:05:00', 12, s2),
      at('Sarrià', '08:19:00', 17, s2),
      at('Sant Cugat Centre', '08:00:00', 10),
      at('Sarrià', '08:14:00', 15),
    ];
    expect(directJourneys(rows, 'Sant Cugat Centre', 'Sarrià').map((j) => j.stop.line)).toEqual(['S1', 'S2']);
  });
});

describe('departuresFrom', () => {
  it('skips terminating arrivals and flags the last train per line and destination', () => {
    const rows = [
      stop({ stationName: 'Sarrià', at: '08:00:00' }),
      stop({ stationName: 'Sarrià', at: '08:10:00' }),
      stop({ stationName: 'Sarrià', at: '08:05:00', line: 'L12', headsign: 'Reina Elisenda' }),
      stop({ stationName: 'Sarrià', at: '08:06:00', line: 'L12', headsign: 'Sarrià' }),
      stop({ stationName: 'Gràcia', at: '08:03:00' }),
    ];
    const result = departuresFrom(rows, 'Sarrià');
    expect(result.map((d) => [formatClock(d.stop.departure), d.stop.line, d.isLast])).toEqual([
      ['08:00', 'S1', false],
      ['08:05', 'L12', true],
      ['08:10', 'S1', true],
    ]);
  });
});
