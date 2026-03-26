import React from 'react';
import { STATIONS } from '../types';
import { MapPin, Star } from 'lucide-react';

interface StationSelectorProps {
  selectedStationId: string;
  onStationChange: (stationId: string) => void;
  favorites: string[];
  onToggleFavorite: (stationId: string) => void;
}

export const StationSelector: React.FC<StationSelectorProps> = ({ 
  selectedStationId, 
  onStationChange,
  favorites,
  onToggleFavorite
}) => {
  const isFavorite = favorites.includes(selectedStationId);

  // Sort stations so favorites appear first
  const sortedStations = [...STATIONS].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
        <MapPin size={14} />
        Select Station
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            value={selectedStationId}
            onChange={(e) => onStationChange(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 px-4 pr-10 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all cursor-pointer font-medium"
          >
            {sortedStations.map((station) => (
              <option key={station.id} value={station.id}>
                {favorites.includes(station.id) ? '⭐ ' : ''}{station.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
        <button
          onClick={() => onToggleFavorite(selectedStationId)}
          className={`p-3 rounded-xl border transition-all active:scale-95 cursor-pointer ${
            isFavorite 
              ? 'bg-orange-50 border-orange-200 text-orange-500 shadow-sm' 
              : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
          }`}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
};
