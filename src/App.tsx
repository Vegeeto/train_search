import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, ArrowRightLeft, Train, Info, AlertCircle, Clock } from 'lucide-react';
import { fetchTrains } from './services/fgcService';
import { FGCJourney, STATIONS, DESTINATIONS } from './types';
import { TrainCard } from './components/TrainCard';
import { StationSelector } from './components/StationSelector';

export default function App() {
  const [selectedStationId, setSelectedStationId] = useState(STATIONS[0].id);
  const [destination, setDestination] = useState(DESTINATIONS.TO_BARCELONA);
  const [trains, setTrains] = useState<FGCJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadTrains = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchTrains(selectedStationId, destination);
      setTrains(results);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load train schedules. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedStationId, destination]);

  useEffect(() => {
    loadTrains();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadTrains, 60000);
    return () => clearInterval(interval);
  }, [loadTrains]);

  const toggleDirection = () => {
    setDestination(prev => 
      prev === DESTINATIONS.TO_BARCELONA 
        ? DESTINATIONS.TO_MOLI_NOU 
        : DESTINATIONS.TO_BARCELONA
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-orange-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white">
              <Train size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">FGC Real-Time</h1>
          </div>
          <button 
            onClick={loadTrains}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''} text-gray-600`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Controls Section */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-6">
          <StationSelector 
            selectedStationId={selectedStationId}
            onStationChange={setSelectedStationId}
          />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <ArrowRightLeft size={14} />
              Direction
            </label>
            <button
              onClick={toggleDirection}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98] flex items-center justify-between group"
            >
              <span className="text-sm opacity-80">To:</span>
              <span className="text-lg">{destination}</span>
              <ArrowRightLeft size={20} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium px-1">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="flex items-center gap-1">
              <Info size={12} />
              Auto-refreshes every minute
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-bold text-gray-500 uppercase tracking-widest text-xs">
              Upcoming Arrivals
            </h2>
            <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Live
            </span>
          </div>

          <AnimatePresence mode="wait">
            {loading && trains.length === 0 ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-4"
              >
                <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-medium animate-pulse">Fetching latest schedules...</p>
              </motion.div>
            ) : error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-100 p-8 rounded-3xl flex flex-col items-center text-center gap-3"
              >
                <AlertCircle size={40} className="text-red-500" />
                <p className="text-red-800 font-semibold">{error}</p>
                <button 
                  onClick={loadTrains}
                  className="mt-2 text-sm font-bold text-red-600 hover:underline"
                >
                  Try again
                </button>
              </motion.div>
            ) : trains.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-50 border border-dashed border-gray-200 p-12 rounded-3xl flex flex-col items-center text-center gap-4"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                  <Train size={32} />
                </div>
                <div>
                  <p className="text-gray-600 font-bold">No trains found</p>
                  <p className="text-gray-400 text-sm mt-1">There are no more scheduled trains for this route today.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                className="grid grid-cols-1 gap-4"
              >
                {trains.map((train, idx) => (
                  <TrainCard key={`${train.stop_id}-${train.arrival_time}-${idx}`} journey={train} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold">
          Data provided by FGC Open Data API
        </p>
        <p className="text-[10px] text-gray-300 mt-2">
          © {new Date().getFullYear()} Real-Time Train Tracker
        </p>
      </footer>
    </div>
  );
}
