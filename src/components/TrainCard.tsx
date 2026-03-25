import React from 'react';
import { motion } from 'motion/react';
import { Train, Clock, MapPin, Accessibility } from 'lucide-react';
import { FGCJourney } from '../types';

interface TrainCardProps {
  journey: FGCJourney;
}

export const TrainCard: React.FC<TrainCardProps> = ({ journey }) => {
  const arrivalTime = journey.arrival_time.substring(0, 5);
  const routeColor = journey.route_color ? `#${journey.route_color}` : '#FF6319';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4 relative overflow-hidden"
    >
      <div 
        className="absolute top-0 left-0 w-1.5 h-full" 
        style={{ backgroundColor: routeColor }}
      />
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: routeColor }}
          >
            {journey.route_short_name}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
              <Train size={16} className="text-gray-400" />
              {journey.trip_headsign}
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin size={12} />
              {journey.stop_name}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 flex items-center gap-1.5 justify-end">
            <Clock size={20} className="text-gray-400" />
            {arrivalTime}
          </div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mt-1">
            Scheduled Arrival
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-2">
          {journey.wheelchair_accessible === 1 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">
              <Accessibility size={12} />
              Accessible
            </div>
          )}
        </div>
        
        <div className="text-[10px] text-gray-400 italic">
          ID: {journey.stop_id}
        </div>
      </div>
    </motion.div>
  );
};
