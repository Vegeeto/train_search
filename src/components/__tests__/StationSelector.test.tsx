import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StationSelector } from '../StationSelector';
import { Station } from '../../types';

const stations: Station[] = [
  { id: 'SJ', name: 'Sant Boi' },
  { id: 'AL', name: 'Almeda' },
  { id: 'CO', name: 'Cornellà Riera' },
];

const renderSelector = (props: Partial<ComponentProps<typeof StationSelector>> = {}) => {
  const onStationChange = vi.fn();
  const onToggleFavorite = vi.fn();
  const utils = render(
    <StationSelector
      stations={stations}
      selectedStationId="AL"
      onStationChange={onStationChange}
      favorites={[]}
      onToggleFavorite={onToggleFavorite}
      {...props}
    />
  );
  return { ...utils, onStationChange, onToggleFavorite };
};

describe('StationSelector', () => {
  it('lists stations alphabetically when there are no favorites', () => {
    renderSelector();
    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options).toEqual(['Almeda', 'Cornellà Riera', 'Sant Boi']);
  });

  it('floats favorites to the top and marks them with a star', () => {
    renderSelector({ favorites: ['SJ'] });
    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options[0]).toBe('⭐ Sant Boi');
    expect(options.slice(1)).toEqual(['Almeda', 'Cornellà Riera']);
  });

  it('reports the selected station id upward', async () => {
    const { onStationChange } = renderSelector();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'CO');
    expect(onStationChange).toHaveBeenCalledWith('CO');
  });

  it('toggles the favorite state of the currently selected station', async () => {
    const { onToggleFavorite } = renderSelector({ selectedStationId: 'CO' });
    await userEvent.click(screen.getByTitle('Add to favorites'));
    expect(onToggleFavorite).toHaveBeenCalledWith('CO');
  });

  it('offers to remove the favorite when the selected station is already starred', () => {
    renderSelector({ selectedStationId: 'CO', favorites: ['CO'] });
    expect(screen.getByTitle('Remove from favorites')).toBeInTheDocument();
  });

  it('disables the dropdown and shows a placeholder while stations are loading', () => {
    renderSelector({ isLoading: true });
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('option')).toHaveTextContent('Loading stations...');
  });

  it('shows an explicit empty state when the route has no stations', () => {
    renderSelector({ stations: [] });
    expect(screen.getByRole('option')).toHaveTextContent('No stations found');
  });

  it('does not mutate the stations prop while sorting', () => {
    const input = [...stations];
    renderSelector({ stations: input, favorites: ['SJ'] });
    expect(input.map(s => s.id)).toEqual(['SJ', 'AL', 'CO']);
  });
});
