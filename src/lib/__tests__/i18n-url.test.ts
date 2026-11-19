import { describe, expect, it } from 'vitest';
import { parseSelection, selectionToSearch } from '../../hooks/useUrlState';
import { createTranslator, detectLang } from '../../i18n';
import { MESSAGES } from '../../i18n/messages';

describe('i18n', () => {
  it('has every key, with the same placeholders, in every language', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const keys = Object.keys(MESSAGES.ca) as (keyof typeof MESSAGES.ca)[];
    for (const lang of ['es', 'en'] as const) {
      expect(Object.keys(MESSAGES[lang]).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(placeholders(MESSAGES[lang][key]), `${lang}.${key}`).toEqual(placeholders(MESSAGES.ca[key]));
    }
  });

  it('interpolates and pluralises', () => {
    const { t, tn } = createTranslator('en');
    expect(t('platform', { p: 2 })).toBe('Platform 2');
    expect(tn('stopsAway', 1)).toBe('1 stop away');
    expect(tn('stopsAway', 3)).toBe('3 stops away');
    expect(createTranslator('ca').tn('stopsAway', 3)).toBe('A 3 parades');
  });

  it('detects the browser language, defaulting to Catalan', () => {
    expect(detectLang(['es-ES', 'en'])).toBe('es');
    expect(detectLang(['fr-FR', 'en-GB'])).toBe('en');
    expect(detectLang(['de'])).toBe('ca');
  });
});

describe('URL state', () => {
  it('parses and validates shared links', () => {
    expect(parseSelection('?from=pc&to=SR&at=08:30')).toEqual({ from: 'PC', to: 'SR', at: '08:30' });
    expect(parseSelection('?from=PC&to=PC')).toEqual({ from: 'PC', to: null, at: null });
    expect(parseSelection("?from=x'--&at=25:00")).toEqual({ from: null, to: null, at: null });
    expect(parseSelection('?to=SR')).toEqual({ from: null, to: null, at: null });
  });

  it('serialises only what is set', () => {
    expect(selectionToSearch({ from: 'PC', to: null, at: null })).toBe('?from=PC');
    expect(selectionToSearch({ from: null, to: 'SR', at: null })).toBe('');
  });
});
