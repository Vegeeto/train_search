import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { timetable } from '../lib/timetable';
import { jsonResponse } from '../test/fixtures';

const STATION_ROWS = [
  ['Barcelona - Plaça Catalunya', 'PC', 'S1', 'EF7900'],
  ['Sarrià', 'SR', 'S1', 'EF7900'],
  ['Sarrià', 'SR', 'L12', 'b2aed3'],
  ['Reina Elisenda', 'RE', 'L12', 'b2aed3'],
  ['Terrassa Nacions Unides', null, 'S1', 'EF7900'],
].map(([stop_name, parent_station, route_short_name, route_color]) => ({
  stop_name,
  parent_station,
  stop_id: `${parent_station ?? 'NA'}1`,
  route_short_name,
  route_color,
  lat: 41.4,
  lon: 2.12,
  wb: 1,
}));

const trip = (stop_name: string, time: string, seq: number, extra: Record<string, unknown> = {}) => ({
  date: '2026-11-19',
  stop_name,
  stop_id: 'X1',
  route_short_name: 'S1',
  route_color: 'EF7900',
  trip_headsign: 'Terrassa Nacions Unides',
  arrival_time: time,
  departure_time: time,
  stop_sequence: seq,
  shape_id: 100009,
  platform_code: 2,
  ...extra,
});

const TIMETABLE = [
  trip('Barcelona - Plaça Catalunya', '08:04:00', 1),
  trip('Barcelona - Plaça Catalunya', '08:10:00', 1),
  trip('Barcelona - Plaça Catalunya', '07:30:00', 1), // already gone
  trip('Sarrià', '08:16:00', 8),
  trip('Sarrià', '08:22:00', 8),
  trip('Sarrià', '07:42:00', 8),
  trip('Sarrià', '08:07:00', 1, { route_short_name: 'L12', trip_headsign: 'Reina Elisenda', shape_id: 43, route_color: 'b2aed3' }),
];

const LIVE = [
  {
    id: 'live-1',
    lin: 'S1',
    desti: 'NA',
    properes_parades: '{"parada": "PC"};{"parada": "PR"};{"parada": "SR"};{"parada": "NA"}',
    estacionat_a: null,
    en_hora: 'True',
    ocupacio_m1_percent: '70',
    ocupacio_m1_tram: '3',
  },
];

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes('posicionament-dels-trens')) return jsonResponse(LIVE);
    if (url.searchParams.get('group_by')) return jsonResponse(STATION_ROWS);
    const where = url.searchParams.get('where') ?? '';
    return jsonResponse(TIMETABLE.filter((r) => where.includes(`'${r.stop_name}'`)));
  });
}

beforeEach(() => {
  timetable.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T07:00:00Z')); // 08:00 in Madrid
  Object.defineProperty(navigator, 'languages', { value: ['en-GB'], configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function pick(label: string, query: string, option: RegExp) {
  const user = userEvent.setup();
  const input = await screen.findByRole('combobox', { name: label });
  await waitFor(() => expect(input).toBeEnabled());
  await user.click(input);
  await user.type(input, query);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('App', () => {
  it('shows upcoming departures with live info for a searched station', async () => {
    mockApi();
    render(<App />);
    await pick('From', 'placa cat', /Plaça Catalunya/);

    const panel = await screen.findByRole('region', { name: 'Next departures' });
    const rows = await within(panel).findAllByRole('listitem');
    expect(rows).toHaveLength(2); // 07:30 has gone
    expect(rows[0]).toHaveTextContent('Terrassa Nacions Unides');
    expect(rows[0]).toHaveTextContent('4 min');
    expect(rows[1]).toHaveTextContent('Last train');
    expect(window.location.search).toBe('?from=PC');

    // The live train, 1 stop away from PC (it's PC's next stop), lands on the first departure.
    expect(await within(rows[0]).findByText(/1 stop away/)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Full')).toBeInTheDocument();
  });

  it('lists direct trains once a destination is added, and saves it as a favourite cookie', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await pick('From', 'catalunya', /Plaça Catalunya/);
    await pick('To', 'sarria', /Sarrià/);

    const panel = await screen.findByRole('region', { name: 'Direct trains' });
    const rows = await within(panel).findAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('08:0408:16· 12 min'), expect.stringContaining('08:1008:22· 12 min')]);
    expect(window.location.search).toBe('?from=PC&to=SR');

    await user.click(screen.getByRole('button', { name: 'Save to favourites' }));
    expect(decodeURIComponent(document.cookie)).toContain('"journeys":[["PC","SR"]]');
    expect(screen.getByRole('button', { name: 'Remove from favourites' })).toHaveAttribute('aria-pressed', 'true');

    // Back home, the favourite is one tap away.
    await user.click(screen.getByRole('button', { name: /FGC Trains/ }));
    const favs = await screen.findByRole('list', { name: 'Favourite journeys' });
    await user.click(within(favs).getByRole('button'));
    expect(await screen.findByRole('region', { name: 'Direct trains' })).toBeInTheDocument();
  });

  it('opens a shared link, honours a picked time, and switches language', async () => {
    window.history.replaceState(null, '', '/?from=SR&at=08:20');
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    const panel = await screen.findByRole('region', { name: 'Departures from 08:20' });
    const rows = await within(panel).findAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('08:22');

    await user.selectOptions(screen.getByLabelText('Language'), 'ca');
    expect(await screen.findByRole('region', { name: 'Sortides des de les 08:20' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ca');
    expect(decodeURIComponent(document.cookie)).toContain('"lang":"ca"');
  });

  it('toggles dark/light mode and remembers it, with the language, in the cookie', async () => {
    mockApi();
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    // No saved theme: follows the system (light in jsdom), no override on <html>.
    expect(document.documentElement.dataset.theme).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Language'), 'es');
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"dark"');
    expect(decodeURIComponent(document.cookie)).toContain('"lang":"es"');

    // A fresh visit restores both from the cookie.
    unmount();
    delete document.documentElement.dataset.theme;
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toBeInTheDocument();
    expect(screen.getByLabelText('Idioma')).toHaveValue('es');

    await user.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"light"');
  });

  it('offers a retry when the station list fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Couldn’t load the FGC station list.', {}, { timeout: 4000 })).toBeInTheDocument();

    fetchMock.mockRestore();
    mockApi();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'From' })).toBeEnabled());
  });

  it('flags a link to a station that does not exist', async () => {
    window.history.replaceState(null, '', '/?from=ZZ');
    mockApi();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The station in the link wasn’t found.');
  });
});
