import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { FGCJourney, ROUTES } from '../types';

vi.mock('../services/fgcService', () => ({
  fetchTrains: vi.fn(),
  fetchStations: vi.fn(),
}));

import { fetchTrains, fetchStations } from '../services/fgcService';

const mockFetchTrains = vi.mocked(fetchTrains);
const mockFetchStations = vi.mocked(fetchStations);

// ─── fixtures ────────────────────────────────────────────────────────────────

const ANOIA_STATIONS = [
  { id: 'AB1', name: 'Abrera' },
  { id: 'AL1', name: 'Almeda' },
  { id: 'PE1', name: 'Barcelona - Plaça Espanya' },
  { id: 'ML1', name: 'Molí Nou - Ciutat Cooperativa' },
];

const VALLES_STATIONS = [
  { id: 'PC1', name: 'Barcelona - Plaça Catalunya' },
  { id: 'SA1', name: 'Sarrià' },
];

const journey = (arrival: string, overrides: Partial<FGCJourney> = {}): FGCJourney => ({
  stop_id: 'ML1',
  stop_name: 'Molí Nou - Ciutat Cooperativa',
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

const journeys = (n: number) =>
  Array.from({ length: n }, (_, i) => journey(`10:${(30 + i).toString().padStart(2, '0')}:00`));

/** The three <select>s are unlabelled for a11y purposes, so scope by their heading. */
const controlByLabel = (label: string) =>
  within(screen.getByText(label).closest('div')!).getByRole('combobox');

const stationSelect = () => controlByLabel('Select Station');
const routeSelect = () => controlByLabel('Route Network');
const timeSelect = () => controlByLabel('Time Filter');
const stationOptions = () =>
  within(stationSelect()).getAllByRole('option').map(o => o.textContent);

/** Arguments of the most recent fetchTrains call, by position. */
const lastTrainsCall = () => {
  const call = mockFetchTrains.mock.calls.at(-1)!;
  return {
    stationName: call[0] as string,
    direction: call[1] as string,
    limit: call[2] as number,
    offset: call[3] as number,
    hour: call[4] as string | undefined,
    trainTypes: call[5] as string[] | undefined,
    routeUrl: call[6] as string | undefined,
    terminal: call[7] as string | undefined,
    routeLongName: call[8] as string | undefined,
  };
};

beforeEach(() => {
  mockFetchStations.mockResolvedValue(ANOIA_STATIONS);
  mockFetchTrains.mockResolvedValue({ results: journeys(3), totalCount: 3 });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── happy path ──────────────────────────────────────────────────────────────

describe('App — initial load', () => {
  it('renders the trains returned for the default station', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('10:30')).toBeInTheDocument());
    expect(screen.getByText('10:32')).toBeInTheDocument();
    // Headsign of the rendered cards.
    expect(screen.getAllByText('Barcelona - Plaça Espanya').length).toBeGreaterThan(0);
  });

  it('fetches the station list for the first route network', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchStations).toHaveBeenCalled());
    expect(mockFetchStations).toHaveBeenCalledWith(ROUTES[0].url, ROUTES[0].routeLongName);
  });

  it('selects a station that actually exists in the fetched list', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    const names = ANOIA_STATIONS.map(s => s.name);
    expect(names).toContain(lastTrainsCall().stationName);
  });

  it('passes the route terminal and page size through to the service', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    const call = lastTrainsCall();
    expect(call.terminal).toBe(ROUTES[0].terminal);
    expect(call.limit).toBe(5);
    expect(call.offset).toBe(0);
    expect(call.direction).toBe('INBOUND');
  });

  it('does not query trains before the station list has resolved', async () => {
    let resolveStations: (v: typeof ANOIA_STATIONS) => void = () => {};
    mockFetchStations.mockReturnValue(new Promise(res => { resolveStations = res; }));

    render(<App />);
    expect(screen.getByText(/Fetching latest schedules/)).toBeInTheDocument();
    expect(mockFetchTrains).not.toHaveBeenCalled();

    resolveStations(ANOIA_STATIONS);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
  });
});

// ─── failure handling ────────────────────────────────────────────────────────

describe('App — failure handling', () => {
  it('shows the error banner when the train query fails', async () => {
    mockFetchTrains.mockRejectedValue(new Error('API error: Service Unavailable'));
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load train schedules/)).toBeInTheDocument()
    );
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('retries the query when "Try again" is clicked', async () => {
    mockFetchTrains.mockRejectedValueOnce(new Error('boom'));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByText('10:30')).toBeInTheDocument());
  });

  it('surfaces an error instead of spinning forever when the station list cannot be loaded', async () => {
    // fetchStations swallows its own errors and resolves to [] — the UI must not
    // be left on the loading spinner with no explanation.
    mockFetchStations.mockResolvedValue([]);
    render(<App />);

    await waitFor(() =>
      expect(screen.queryByText(/Fetching latest schedules/)).not.toBeInTheDocument()
    );
    expect(screen.getByText(/No stations/i)).toBeInTheDocument();
    expect(mockFetchTrains).not.toHaveBeenCalled();
  });

  it('starts up with an empty favorites list when localStorage holds corrupt JSON', async () => {
    localStorage.setItem('fgc_favorites', '{not json');
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    expect(screen.getByTitle('Add to favorites')).toBeInTheDocument();
  });

  it('ignores a stored favorites value that is not an array of station ids', async () => {
    localStorage.setItem('fgc_favorites', JSON.stringify({ ML1: true }));
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    expect(stationOptions()).toHaveLength(ANOIA_STATIONS.length);
  });

  it('shows the empty state when the station has no upcoming trains', async () => {
    mockFetchTrains.mockResolvedValue({ results: [], totalCount: 0 });
    render(<App />);
    await waitFor(() => expect(screen.getByText('No trains found')).toBeInTheDocument());
  });
});

// ─── filters ─────────────────────────────────────────────────────────────────

describe('App — filters', () => {
  it('re-queries with the chosen hour and hides the live badge', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());

    await userEvent.selectOptions(timeSelect(), '14');
    await waitFor(() => expect(lastTrainsCall().hour).toBe('14'));
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto-refreshing')).not.toBeInTheDocument();
  });

  it('re-queries with the selected train types and stops advertising auto-refresh', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    expect(screen.getByText('Auto-refreshing')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Train Types').closest('div')!.querySelector('button')!);
    await userEvent.click(screen.getByRole('button', { name: 'L8' }));

    await waitFor(() => expect(lastTrainsCall().trainTypes).toEqual(['L8']));
    // Auto-refresh is switched off when a type filter is active; the badge must agree.
    expect(screen.queryByText('Auto-refreshing')).not.toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('clears train type selections when the route network changes', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());

    await userEvent.click(screen.getByText('Train Types').closest('div')!.querySelector('button')!);
    await userEvent.click(screen.getByRole('button', { name: 'L8' }));
    await waitFor(() => expect(lastTrainsCall().trainTypes).toEqual(['L8']));

    mockFetchStations.mockResolvedValue(VALLES_STATIONS);
    await userEvent.selectOptions(routeSelect(), ROUTES[1].url);

    await waitFor(() => expect(lastTrainsCall().routeUrl).toBe(ROUTES[1].url));
    expect(lastTrainsCall().trainTypes).toBeUndefined();
    expect(lastTrainsCall().terminal).toBe(ROUTES[1].terminal);
  });

  it('offers only the train types belonging to the selected route', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    await userEvent.click(screen.getByText('Train Types').closest('div')!.querySelector('button')!);

    for (const type of ROUTES[0].trainTypes) {
      expect(screen.getByRole('button', { name: type })).toBeInTheDocument();
    }
    // A Barcelona-Vallès-only line must not be offered on Llobregat-Anoia.
    expect(screen.queryByRole('button', { name: 'L6' })).not.toBeInTheDocument();
  });
});

// ─── direction ───────────────────────────────────────────────────────────────

describe('App — direction', () => {
  it('toggles between inbound and outbound at a normal station', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: new RegExp(`To ${ROUTES[0].terminal}`) }));
    await waitFor(() => expect(lastTrainsCall().direction).toBe('OUTBOUND'));

    await userEvent.click(screen.getByRole('button', { name: /Outbound \/ Other/ }));
    await waitFor(() => expect(lastTrainsCall().direction).toBe('INBOUND'));
  });

  it('forces outbound and locks the toggle at the terminal station', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());

    await userEvent.selectOptions(stationSelect(), 'PE1');

    await waitFor(() => expect(lastTrainsCall().stationName).toBe(ROUTES[0].terminal));
    await waitFor(() => expect(lastTrainsCall().direction).toBe('OUTBOUND'));
    expect(screen.getByText(/Only outbound trains available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Outbound \/ Other/ })).toBeDisabled();
  });
});

// ─── pagination ──────────────────────────────────────────────────────────────

describe('App — pagination', () => {
  it('requests the next page with the right offset', async () => {
    mockFetchTrains.mockResolvedValue({ results: journeys(5), totalCount: 12 });
    render(<App />);
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole('button').find(b =>
      b.querySelector('svg.lucide-chevron-right')
    )!);

    await waitFor(() => expect(lastTrainsCall().offset).toBe(5));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('does not leave the user stranded on a page that no longer exists', async () => {
    // Live mode drops departed trains, so totalCount shrinks between refreshes.
    mockFetchTrains.mockResolvedValue({ results: journeys(5), totalCount: 12 });
    render(<App />);
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole('button').find(b =>
      b.querySelector('svg.lucide-chevron-right')
    )!);
    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument());

    // The window shrinks to a single page while the user sits on page 2: offset 5 is
    // now past the end, so the app must fall back to page 1 rather than show nothing.
    mockFetchTrains.mockImplementation(async (_name, _dir, limit, offset) => {
      const all = journeys(3);
      return { results: all.slice(offset, offset + limit), totalCount: all.length };
    });
    await userEvent.click(screen.getByTitle('Refresh schedules'));

    await waitFor(() => expect(lastTrainsCall().offset).toBe(0));
    await waitFor(() => expect(screen.getByText('10:30')).toBeInTheDocument());
    expect(screen.queryByText('No trains found')).not.toBeInTheDocument();
  });
});

// ─── favorites ───────────────────────────────────────────────────────────────

describe('App — favorites', () => {
  it('persists a starred station to localStorage', async () => {
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());

    await userEvent.click(screen.getByTitle('Add to favorites'));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fgc_favorites')!)).toHaveLength(1);
    });
    expect(screen.getByTitle('Remove from favorites')).toBeInTheDocument();
  });

  it('restores favorites saved by a previous session', async () => {
    localStorage.setItem('fgc_favorites', JSON.stringify(['AL1']));
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalled());
    expect(stationOptions()[0]).toBe('⭐ Almeda');
  });
});

// ─── stale responses ─────────────────────────────────────────────────────────

describe('App — concurrent requests', () => {
  it('ignores a slow response for a station the user has already moved away from', async () => {
    let resolveFirst: (v: { results: FGCJourney[]; totalCount: number }) => void = () => {};
    mockFetchTrains.mockImplementationOnce(
      () => new Promise(res => { resolveFirst = res; })
    );
    render(<App />);
    await waitFor(() => expect(mockFetchTrains).toHaveBeenCalledTimes(1));

    // Second selection resolves immediately.
    mockFetchTrains.mockResolvedValue({
      results: [journey('12:00:00', { stop_name: 'Almeda', trip_headsign: 'Almeda train' })],
      totalCount: 1,
    });
    await userEvent.selectOptions(stationSelect(), 'AL1');
    await waitFor(() => expect(screen.getByText('Almeda train')).toBeInTheDocument());

    // The stale first request finally lands — it must not overwrite the new data.
    resolveFirst({
      results: [journey('09:00:00', { trip_headsign: 'Stale train' })],
      totalCount: 1,
    });

    await waitFor(() => expect(screen.getByText('Almeda train')).toBeInTheDocument());
    expect(screen.queryByText('Stale train')).not.toBeInTheDocument();
  });
});

// ─── auto refresh ────────────────────────────────────────────────────────────

describe('App — auto refresh', () => {
  it('polls every 60s in live mode and stops once an hour filter is applied', async () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      // Let the station fetch and the first train fetch settle.
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(mockFetchTrains).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(mockFetchTrains).toHaveBeenCalledTimes(2);

      // Applying an hour filter switches the app out of live mode.
      fireEvent.change(timeSelect(), { target: { value: '14' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(lastTrainsCall().hour).toBe('14');

      const callsBefore = mockFetchTrains.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
      expect(mockFetchTrains.mock.calls.length).toBe(callsBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});
