import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrainCard } from '../TrainCard';
import { FGCJourney } from '../../types';

const journey = (overrides: Partial<FGCJourney> = {}): FGCJourney => ({
  stop_id: 'ML1',
  stop_name: 'Molí Nou - Ciutat Cooperativa',
  arrival_time: '10:35:00',
  departure_time: '10:35:30',
  trip_headsign: 'Barcelona - Plaça Espanya',
  route_short_name: 'L8',
  route_color: 'FF6319',
  date: '2024-01-15',
  stop_lat: 41.3,
  stop_lon: 2.1,
  ...overrides,
});

describe('TrainCard', () => {
  it('renders the headsign, stop name, line badge and HH:MM arrival time', () => {
    render(<TrainCard journey={journey()} />);
    expect(screen.getByText('Barcelona - Plaça Espanya')).toBeInTheDocument();
    expect(screen.getByText('Molí Nou - Ciutat Cooperativa')).toBeInTheDocument();
    expect(screen.getByText('L8')).toBeInTheDocument();
    // Seconds must be trimmed off — the API returns HH:MM:SS.
    expect(screen.getByText('10:35')).toBeInTheDocument();
    expect(screen.queryByText('10:35:00')).not.toBeInTheDocument();
  });

  it('uses the route colour from the API', () => {
    const { container } = render(<TrainCard journey={journey({ route_color: '0064A8' })} />);
    const coloured = container.querySelector('[style*="rgb(0, 100, 168)"]');
    expect(coloured).toBeTruthy();
  });

  it('falls back to the brand colour when route_color is missing', () => {
    const { container } = render(<TrainCard journey={journey({ route_color: '' })} />);
    // #FF6319
    expect(container.querySelector('[style*="rgb(255, 99, 25)"]')).toBeTruthy();
  });

  it('shows the last-train badge only when the journey is flagged', () => {
    const { rerender } = render(<TrainCard journey={journey()} />);
    expect(screen.queryByText('Last Train')).not.toBeInTheDocument();

    rerender(<TrainCard journey={journey({ is_last_train: true })} />);
    expect(screen.getByText('Last Train')).toBeInTheDocument();
  });

  it('shows the accessibility badge only for wheelchair_accessible === 1', () => {
    const { rerender } = render(<TrainCard journey={journey({ wheelchair_accessible: 1 })} />);
    expect(screen.getByText('Accessible')).toBeInTheDocument();

    rerender(<TrainCard journey={journey({ wheelchair_accessible: 0 })} />);
    expect(screen.queryByText('Accessible')).not.toBeInTheDocument();

    rerender(<TrainCard journey={journey({ wheelchair_accessible: undefined })} />);
    expect(screen.queryByText('Accessible')).not.toBeInTheDocument();
  });

  it('displays the platform stop_id, which distinguishes rows at multi-platform hubs', () => {
    render(<TrainCard journey={journey({ stop_id: 'PC4' })} />);
    expect(screen.getByText(/PC4/)).toBeInTheDocument();
  });
});
