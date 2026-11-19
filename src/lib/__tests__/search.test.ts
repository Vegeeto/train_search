import { describe, expect, it } from 'vitest';
import { station } from '../../test/fixtures';
import { normalize, searchStations } from '../search';

const STATIONS = [
  station({ code: 'PC', name: 'Barcelona - Plaça Catalunya' }),
  station({ code: 'PE', name: 'Barcelona - Plaça Espanya' }),
  station({ code: 'PM', name: 'Pl. Molina' }),
  station({ code: 'SR', name: 'Sarrià' }),
  station({ code: 'SC', name: 'Sant Cugat Centre' }),
  station({ code: 'LH', name: "L'Hospitalet Av. Carrilet" }),
  station({ code: 'TB', name: 'Av. Tibidabo' }),
  station({ code: 'SM', name: 'St. Llorenç de Montgai' }),
  station({ code: 'EN', name: 'Terrassa  Estació del nord' }),
];

const names = (query: string) => searchStations(STATIONS, query).map((s) => s.code);

describe('normalize', () => {
  it('strips accents, punctuation and extra spaces', () => {
    expect(normalize('Barcelona - Plaça Catalunya')).toBe('barcelona placa catalunya');
    expect(normalize("L'Hospitalet")).toBe('l hospitalet');
    expect(normalize('Col·legi')).toBe('collegi');
  });
});

describe('searchStations', () => {
  it('matches word prefixes without accents', () => {
    expect(names('placa cat')[0]).toBe('PC');
    expect(names('sarria')).toEqual(['SR']);
  });

  it('expands common abbreviations on both sides', () => {
    expect(names('plaza molina')[0]).toBe('PM');
    expect(names('avinguda tibidabo')[0]).toBe('TB');
    expect(names('sant llorenc')[0]).toBe('SM');
  });

  it('accepts the station code', () => {
    expect(names('pe')[0]).toBe('PE');
  });

  it('matches words in any order and survives double spaces in names', () => {
    expect(names('catalunya placa')[0]).toBe('PC');
    expect(names('estacio nord')).toEqual(['EN']);
  });

  it('returns nothing for unrelated text', () => {
    expect(names('zzz')).toEqual([]);
    expect(names('  ')).toEqual([]);
  });
});
