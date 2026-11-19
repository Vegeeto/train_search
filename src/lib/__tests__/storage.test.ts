import { describe, expect, it } from 'vitest';
import { COOKIE_NAME, addRecent, emptyPrefs, encodePrefs, loadPrefs, sanitizePrefs, savePrefs, toggleJourney, toggleStation } from '../storage';

describe('cookie persistence', () => {
  it('round-trips preferences through the cookie', () => {
    const prefs = { ...emptyPrefs(), stations: ['PC'], journeys: [['SC', 'SR']] as [string, string][], lang: 'es' as const, theme: 'dark' as const };
    savePrefs(prefs);
    expect(document.cookie).toContain(`${COOKIE_NAME}=`);
    expect(loadPrefs()).toEqual({ ...prefs, recents: [] });
  });

  it('survives a corrupt cookie', () => {
    document.cookie = `${COOKIE_NAME}=%7Bnot-json; Path=/`;
    expect(loadPrefs()).toEqual(emptyPrefs());
  });

  it('drops anything that is not a station code', () => {
    const prefs = sanitizePrefs({
      stations: ['PC', "x' or 1=1", 42, 'PC'],
      journeys: [['PC', 'SR'], ['PC', 'PC'], ['bad code', 'SR'], 'nope'],
      recents: [['PC', null], ['SR', 'PC'], [1, 2]],
      lang: 'fr',
      theme: 'sepia',
    });
    expect(prefs).toEqual({ stations: ['PC'], journeys: [['PC', 'SR']], recents: [['PC', null], ['SR', 'PC']], lang: null, theme: null });
    expect(sanitizePrefs({ lang: 'en', theme: 'dark' })).toMatchObject({ lang: 'en', theme: 'dark' });
    expect(sanitizePrefs('string')).toEqual(emptyPrefs());
  });

  it('keeps the encoded cookie under the browser size limit', () => {
    const many = Array.from({ length: 500 }, (_, i) => [`A${i % 10}`, `B${i % 10}`] as [string, string]);
    const encoded = encodePrefs({ ...emptyPrefs(), journeys: many, recents: many.map(([a]) => [a, null]) });
    expect(encoded.length).toBeLessThanOrEqual(3800);
  });
});

describe('updaters', () => {
  it('toggles favourite stations and journeys', () => {
    let p = toggleStation(emptyPrefs(), 'PC');
    expect(p.stations).toEqual(['PC']);
    p = toggleStation(p, 'PC');
    expect(p.stations).toEqual([]);

    p = toggleJourney(p, 'SC', 'SR');
    expect(p.journeys).toEqual([['SC', 'SR']]);
    p = toggleJourney(p, 'SR', 'SC'); // the reverse trip is a separate favourite
    expect(p.journeys).toEqual([['SR', 'SC'], ['SC', 'SR']]);
    p = toggleJourney(p, 'SC', 'SR');
    expect(p.journeys).toEqual([['SR', 'SC']]);
  });

  it('keeps recents unique, newest first and bounded', () => {
    let p = emptyPrefs();
    for (const code of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'B']) p = addRecent(p, code, null);
    expect(p.recents.map(([a]) => a)).toEqual(['B', 'G', 'F', 'E', 'D', 'C']);
  });
});
