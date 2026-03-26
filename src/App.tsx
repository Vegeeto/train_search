import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, ArrowRightLeft, Train, Info, AlertCircle, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchTrains } from './services/fgcService';
import { FGCJourney, STATIONS, DIRECTIONS, ROUTES, TRAIN_TYPES, BARCELONA_TERMINAL } from './types';
import { TrainCard } from './components/TrainCard';
import { StationSelector } from './components/StationSelector';

const ITEMS_PER_PAGE = 5;

export default function App() {
  const [selectedStationId, setSelectedStationId] = useState(STATIONS[0].id);
  const [direction, setDirection] = useState(DIRECTIONS.INBOUND);
  const [selectedRouteUrl, setSelectedRouteUrl] = useState(ROUTES[0].url);
  const [selectedHour, setSelectedHour] = useState<string>('');
  const [selectedTrainTypes, setSelectedTrainTypes] = useState<string[]>([]);
  const [isTrainTypesExpanded, setIsTrainTypesExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [trains, setTrains] = useState<FGCJourney[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('fgc_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('fgc_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (stationId: string) => {
    setFavorites(prev => 
      prev.includes(stationId) 
        ? prev.filter(id => id !== stationId) 
        : [...prev, stationId]
    );
  };

  const loadTrains = useCallback(async (page: number = 0) => {
    setLoading(true);
    setError(null);
    try {
      const offset = page * ITEMS_PER_PAGE;
      const selectedStation = STATIONS.find(s => s.id === selectedStationId);
      const { results, totalCount: count } = await fetchTrains(
        selectedStationId, 
        direction, 
        ITEMS_PER_PAGE, 
        offset, 
        selectedHour || undefined,
        selectedTrainTypes.length > 0 ? selectedTrainTypes : undefined,
        selectedRouteUrl || undefined,
        selectedStation?.name
      );
      setTrains(results);
      setTotalCount(count);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load train schedules. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedStationId, direction, selectedHour, selectedTrainTypes, selectedRouteUrl]);

  useEffect(() => {
    loadTrains(currentPage);
    // Auto-refresh every 60 seconds if no specific hour is selected
    if (!selectedHour && selectedTrainTypes.length === 0) {
      const interval = setInterval(() => loadTrains(currentPage), 60000);
      return () => clearInterval(interval);
    }
  }, [loadTrains, currentPage, selectedHour, selectedTrainTypes, selectedRouteUrl]);

  const handleHourChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedHour(e.target.value);
    setCurrentPage(0); // Reset to first page on filter change
  };

  const handleRouteChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRouteUrl(e.target.value);
    setCurrentPage(0);
  };

  const toggleTrainType = (type: string) => {
    setSelectedTrainTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
    setCurrentPage(0);
  };

  const toggleDirection = () => {
    if (selectedStationId === 'ES') return; // Prevent toggle if at Plaça Espanya
    
    setDirection(prev => 
      prev === DIRECTIONS.INBOUND 
        ? DIRECTIONS.OUTBOUND 
        : DIRECTIONS.INBOUND
    );
    setCurrentPage(0);
  };

  // Effect to handle station-specific direction constraints
  useEffect(() => {
    if (selectedStationId === 'ES' && direction === DIRECTIONS.INBOUND) {
      setDirection(DIRECTIONS.OUTBOUND);
      setCurrentPage(0);
    }
  }, [selectedStationId, direction]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
            onClick={() => loadTrains(currentPage)}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''} text-gray-600`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Controls Section */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Info size={14} />
              Route Network
            </label>
            <select
              value={selectedRouteUrl}
              onChange={handleRouteChange}
              className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all appearance-none cursor-pointer font-medium"
            >
              {ROUTES.map(route => (
                <option key={route.url} value={route.url}>{route.name}</option>
              ))}
            </select>
          </div>

          <StationSelector 
            selectedStationId={selectedStationId}
            onStationChange={(id) => {
              setSelectedStationId(id);
              setCurrentPage(0);
            }}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <ArrowRightLeft size={14} />
                Direction
              </label>
              <button
                onClick={toggleDirection}
                disabled={selectedStationId === 'ES'}
                className={`w-full bg-gradient-to-r ${
                  selectedStationId === 'ES' 
                    ? 'from-gray-400 to-gray-500 cursor-not-allowed opacity-60' 
                    : 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] cursor-pointer'
                } text-white font-semibold py-3 px-4 rounded-2xl shadow-lg transition-all flex items-center justify-between group`}
              >
                <span className="text-lg truncate mr-2">
                  {direction === DIRECTIONS.INBOUND ? `To ${BARCELONA_TERMINAL}` : 'Outbound / Other'}
                </span>
                {selectedStationId !== 'ES' && (
                  <ArrowRightLeft size={18} className="group-hover:rotate-180 transition-transform duration-500 flex-shrink-0" />
                )}
              </button>
              {selectedStationId === 'ES' && (
                <p className="text-[10px] text-orange-500 font-bold px-1">
                  Only outbound trains available from this station
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Clock size={14} />
                Time Filter
              </label>
              <select
                value={selectedHour}
                onChange={handleHourChange}
                className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all appearance-none cursor-pointer font-medium"
              >
                <option value="">Now (Next arrivals)</option>
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i.toString()}>
                    {i.toString().padStart(2, '0')}:00 - {i.toString().padStart(2, '0')}:59
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Train size={14} />
                  Train Types
                  {selectedTrainTypes.length > 0 && (
                    <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[10px]">
                      {selectedTrainTypes.length} selected
                    </span>
                  )}
                </label>
                <button 
                  onClick={() => setIsTrainTypesExpanded(!isTrainTypesExpanded)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 cursor-pointer"
                >
                  {isTrainTypesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              
              <AnimatePresence>
                {isTrainTypesExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
                      {TRAIN_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => toggleTrainType(type)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            selectedTrainTypes.includes(type)
                              ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    {selectedTrainTypes.length > 0 && (
                      <button 
                        onClick={() => setSelectedTrainTypes([])}
                        className="text-[10px] text-orange-500 font-bold uppercase tracking-wider hover:underline self-start mt-3 cursor-pointer"
                      >
                        Clear filters
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium px-1">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            {!selectedHour && (
              <div className="flex items-center gap-1">
                <Info size={12} />
                Auto-refreshes every minute
              </div>
            )}
          </div>
        </section>

        {/* Results Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-bold text-gray-500 uppercase tracking-widest text-xs">
              {selectedHour ? `Schedules for ${selectedHour.padStart(2, '0')}:00` : 'Upcoming Arrivals'}
            </h2>
            {!selectedHour && (
              <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Live
              </span>
            )}
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
                  onClick={() => loadTrains(currentPage)}
                  className="mt-2 text-sm font-bold text-red-600 hover:underline cursor-pointer"
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
                  <p className="text-gray-400 text-sm mt-1">
                    {selectedHour 
                      ? `There are no trains scheduled for the selected hour.` 
                      : 'There are no more scheduled trains for this route today.'}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                className="flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 gap-4">
                  {trains.map((train, idx) => (
                    <TrainCard key={`${train.stop_id}-${train.arrival_time}-${idx}`} journey={train} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0 || loading}
                      className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-gray-500">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage === totalPages - 1 || loading}
                      className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
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
