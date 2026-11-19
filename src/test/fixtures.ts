import { parseGtfsTime } from '../lib/time';
import type { LiveTrain, Station, StopTime } from '../lib/types';

export function stop(partial: Partial<StopTime> & { at?: string }): StopTime {
  const { at, ...rest } = partial;
  const t = at ? parseGtfsTime(at) : 8 * 3600;
  return {
    date: '2026-11-19',
    stationName: 'Sarrià',
    stopId: 'SR1',
    line: 'S1',
    color: '#ef7900',
    textColor: '#111111',
    headsign: 'Barcelona - Plaça Catalunya',
    arrival: t,
    departure: t,
    sequence: 5,
    shapeId: 200009,
    platform: '1',
    ...rest,
  };
}

export function station(partial: Partial<Station> & Pick<Station, 'code' | 'name'>): Station {
  return { lat: 41.4, lon: 2.1, lines: [], accessible: false, ...partial };
}

export function train(partial: Partial<LiveTrain>): LiveTrain {
  return { id: 'T1', line: 'S1', destCode: 'PC', nextStops: [], atStation: null, onTime: true, occupancy: null, ...partial };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
