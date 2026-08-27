import { describe, it, expect } from 'vitest';
import { ROUTES, STATIONS, DIRECTIONS } from '../types';

/**
 * These are pure configuration invariants. They exist because a typo in a
 * `terminal` string is invisible in code review but silently zeroes out every
 * INBOUND query for a whole network: `fetchTrains` builds
 * `trip_headsign='<terminal>'`, and the FGC API returns 0 rows for a headsign
 * that doesn't exist in the dataset.
 *
 * The expected values below were read off the live dataset
 * (`group_by=trip_headsign` / `group_by=stop_name`). `fgcService.live.test.ts`
 * re-verifies them against the real API when RUN_LIVE_TESTS=1.
 */
describe('ROUTES configuration', () => {
  it('uses terminal names that exist verbatim in the FGC dataset', () => {
    // Must match dataset `stop_name` AND `trip_headsign` exactly — abbreviations
    // such as "Pl. Catalunya" or invented names such as "Lleida Pirineus" match
    // nothing and break the network's default (INBOUND) direction entirely.
    const terminals = Object.fromEntries(ROUTES.map(r => [r.name, r.terminal]));
    expect(terminals).toEqual({
      'Llobregat-Anoia': 'Barcelona - Plaça Espanya',
      'Barcelona-Vallès': 'Barcelona - Plaça Catalunya',
      'Lleida-La Pobla': 'Lleida',
    });
  });

  it('gives every route a distinct url and a non-empty train type list', () => {
    const urls = ROUTES.map(r => r.url);
    expect(new Set(urls).size).toBe(urls.length);
    ROUTES.forEach(route => {
      expect(route.trainTypes.length).toBeGreaterThan(0);
      expect(new Set(route.trainTypes).size).toBe(route.trainTypes.length);
    });
  });

  it('produces a non-empty slug from every route url', () => {
    ROUTES.forEach(route => {
      const slug = route.url.split('/').pop()?.replace('.asp', '') ?? '';
      expect(slug).not.toBe('');
      expect(slug).not.toContain('/');
    });
  });

  it('only uses routeLongName for Lleida-La Pobla, whose records carry route_url=null', () => {
    const withLongName = ROUTES.filter(r => r.routeLongName);
    expect(withLongName.map(r => r.name)).toEqual(['Lleida-La Pobla']);
    expect(withLongName[0].routeLongName).toBe('Lleida - La Pobla');
  });

  it('exposes both directions', () => {
    expect(DIRECTIONS).toEqual({ INBOUND: 'INBOUND', OUTBOUND: 'OUTBOUND' });
  });
});

describe('STATIONS bootstrap list', () => {
  it('is non-empty so App has an initial selection before the API responds', () => {
    expect(STATIONS.length).toBeGreaterThan(0);
    expect(STATIONS[0]).toHaveProperty('id');
    expect(STATIONS[0]).toHaveProperty('name');
  });

  it('has unique ids', () => {
    const ids = STATIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
