import React from 'react';
import { STATIONS, Station } from '../types';
import { MapPin } from 'lucide-react';

interface StationSelectorProps {
  selectedStationId: string;
  onStationChange: (stationId: string) => void;
}

export const StationSelector: React.FC<StationSelectorProps> = ({ 
  selectedStationId, 
  onStationChange 
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
        <MapPin size={14} />
        Select Station
      </label>
      <div className="relative">
        <select
          value={selectedStationId}
          onChange={(e) => onStationChange(e.target.value)}
          className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 px-4 pr-10 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all cursor-pointer font-medium"
        >
          {STATIONS.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
