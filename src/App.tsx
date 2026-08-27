import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, ArrowRightLeft, Train, Info, AlertCircle, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { fetchTrains, fetchStations } from './services/fgcService';
import { FGCJourney, STATIONS, DIRECTIONS, ROUTES, Station } from './types';
import { TrainCard } from './components/TrainCard';
import { StationSelector } from './components/StationSelector';

const ITEMS_PER_PAGE = 5;

const FAVORITES_KEY = 'fgc_favorites';

// localStorage is user-writable and survives across app versions, so it can hold
// anything: a truncated write, a value from an older schema, or something a browser
// extension put there. Parsing it unguarded in a useState initializer takes the whole
// app down with a blank screen, so anything unexpected is discarded instead.
const readFavorites = (): string[] => {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    console.warn('Discarding unreadable favorites from localStorage');
    return [];
  }
};

export default function App() {
  const [stations, setStations] = useState<Station[]>(STATIONS);
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
  const [isSyncingStations, setIsSyncingStations] = useState(false);
  const isSyncingRef = useRef(false);
  const latestRequestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [stationsReloadKey, setStationsReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // Private-browsing / quota errors must not break the app.
      console.warn('Could not persist favorites');
    }
  }, [favorites]);

  const toggleFavorite = (stationId: string) => {
    setFavorites(prev => 
      prev.includes(stationId) 
        ? prev.filter(id => id !== stationId) 
        : [...prev, stationId]
    );
  };

  const currentRoute = ROUTES.find(r => r.url === selectedRouteUrl) || ROUTES[0];
  const selectedStationName = stations.find(s => s.id === selectedStationId)?.name;
  const isTerminal = selectedStationName === currentRoute.terminal;

  // Remembered so a route switch can keep the user on the same station when that
  // station exists on the new network under a different stop_id.
  const selectedStationNameRef = useRef<string | undefined>(selectedStationName);
  selectedStationNameRef.current = selectedStationName;

  const loadTrains = useCallback(async (page: number = 0) => {
    if (!selectedStationName) {
      // No station to query (e.g. the station list failed to load). Leaving `loading`
      // set here would pin the UI on the spinner forever.
      setTrains([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    // Responses can arrive out of order when the user changes station/filter while a
    // request is still in flight; only the newest request may touch state.
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const offset = page * ITEMS_PER_PAGE;
      const { results, totalCount: count } = await fetchTrains(
        selectedStationName,
        direction,
        ITEMS_PER_PAGE,
        offset,
        selectedHour || undefined,
        selectedTrainTypes.length > 0 ? selectedTrainTypes : undefined,
        selectedRouteUrl || undefined,
        currentRoute.terminal,
        currentRoute.routeLongName
      );
      if (requestId !== latestRequestRef.current) return;
      setTrains(results);
      setTotalCount(count);
      setLastUpdated(new Date());
      // The live window shrinks as trains depart, so the page the user is on can stop
      // existing between refreshes. Without this the user is stranded on an empty page
      // with the pagination controls hidden.
      if (page > 0 && page * ITEMS_PER_PAGE >= count) {
        setCurrentPage(0);
      }
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError('Failed to load train schedules. Please try again.');
      console.error(err);
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  }, [selectedStationName, direction, selectedHour, selectedTrainTypes, selectedRouteUrl, currentRoute]);

  // Station loading must be declared before train loading so React runs it first.
  // isSyncingRef is set synchronously here, giving the train loading effect a reliable guard.
  useEffect(() => {
    let isMounted = true;
    isSyncingRef.current = true;
    const loadStations = async () => {
      console.debug('Syncing stations for route:', selectedRouteUrl);
      setIsSyncingStations(true);
      try {
        const fetchedStations = await fetchStations(selectedRouteUrl, currentRoute.routeLongName);
        console.debug('Fetched stations:', fetchedStations);
        if (isMounted) {
          if (fetchedStations.length > 0) {
            setStations(fetchedStations);
            setStationsError(null);
            const stationExists = fetchedStations.some(s => s.id === selectedStationId);
            if (!stationExists) {
              // Prefer the same station by name: stop_ids differ per platform and per
              // network, so an id match alone would drop the user on an unrelated stop.
              const sameName = fetchedStations.find(
                s => s.name === selectedStationNameRef.current
              );
              setSelectedStationId((sameName ?? fetchedStations[0]).id);
              setCurrentPage(0);
            }
          } else {
            // fetchStations swallows its own errors and resolves to [], so an empty list
            // means either "no data for this route" or "the request failed" — both need
            // to be surfaced rather than leaving the user on a blank, silent screen.
            setStations([]);
            setStationsError('Could not load the station list for this route.');
            console.warn('No stations found for route:', selectedRouteUrl);
          }
        }
      } catch (err) {
        console.error('Failed to sync stations:', err);
        if (isMounted) {
          setStations([]);
          setStationsError('Could not load the station list for this route.');
        }
      } finally {
        if (isMounted) {
          isSyncingRef.current = false;
          setIsSyncingStations(false);
        }
      }
    };
    loadStations();
    return () => { isMounted = false; };
  }, [selectedRouteUrl, stationsReloadKey]);

  useEffect(() => {
    if (isSyncingRef.current) return;

    loadTrains(currentPage);
    // Auto-refresh every 60 seconds if no specific hour is selected
    if (!selectedHour && selectedTrainTypes.length === 0) {
      const interval = setInterval(() => loadTrains(currentPage), 60000);
      return () => clearInterval(interval);
    }
  }, [loadTrains, currentPage, isSyncingStations]);

  const handleHourChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedHour(e.target.value);
    setCurrentPage(0); // Reset to first page on filter change
  };

  const handleRouteChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRouteUrl(e.target.value);
    setSelectedTrainTypes([]); // train types are route-specific; stale selections wouldn't apply
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
    if (isTerminal) return; // Prevent toggle if at terminal

    setDirection(prev =>
      prev === DIRECTIONS.INBOUND
        ? DIRECTIONS.OUTBOUND
        : DIRECTIONS.INBOUND
    );
    setCurrentPage(0);
  };

  // Effect to handle station-specific direction constraints
  useEffect(() => {
    if (isTerminal && direction === DIRECTIONS.INBOUND) {
      setDirection(DIRECTIONS.OUTBOUND);
      setCurrentPage(0);
    }
  }, [isTerminal, direction]);

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
            stations={stations}
            selectedStationId={selectedStationId}
            onStationChange={(id) => {
              setSelectedStationId(id);
              setCurrentPage(0);
            }}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            isLoading={isSyncingStations}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <ArrowRightLeft size={14} />
                Direction
              </label>
              <button
                onClick={toggleDirection}
                disabled={isTerminal}
                className={`w-full bg-gradient-to-r ${
                  isTerminal 
                    ? 'from-gray-400 to-gray-500 cursor-not-allowed opacity-60' 
                    : 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] cursor-pointer'
                } text-white font-semibold py-3 px-4 rounded-2xl shadow-lg transition-all flex items-center justify-between group`}
              >
                <span className="text-lg truncate mr-2">
                  {direction === DIRECTIONS.INBOUND ? `To ${currentRoute.terminal}` : 'Outbound / Other'}
                </span>
                {!isTerminal && (
                  <ArrowRightLeft size={18} className="group-hover:rotate-180 transition-transform duration-500 flex-shrink-0" />
                )}
              </button>
              {isTerminal && (
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
                      {currentRoute.trainTypes.map(type => (
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

          {/* Removed old last updated location */}
        </section>

        {/* Results Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex flex-col">
              <h2 className="font-bold text-gray-700 uppercase tracking-widest text-xs">
                {selectedHour ? `Schedules for ${selectedHour.padStart(2, '0')}:00` : 'Upcoming Arrivals'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold mt-1 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-fit">
                <Clock size={12} className={loading ? "animate-spin text-orange-500" : "text-gray-400"} />
                <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                {!selectedHour && selectedTrainTypes.length === 0 && (
                  <>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <RefreshCw size={10} />
                      Auto-refreshing
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!selectedHour && selectedTrainTypes.length === 0 && (
                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Live
                </span>
              )}
              <button
                onClick={() => loadTrains(currentPage)}
                disabled={loading}
                className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-orange-500 transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
                title="Refresh schedules"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {trains.some(t => t.is_last_train) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center gap-3 text-orange-800 mx-2"
            >
              <AlertTriangle size={20} className="text-orange-500 shrink-0" />
              <div className="text-sm font-medium">
                <span className="font-bold">Last train of the day detected!</span> This is the final service for today's schedule.
              </div>
            </motion.div>
          )}

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
            ) : (error || stationsError) ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-100 p-8 rounded-3xl flex flex-col items-center text-center gap-3"
              >
                <AlertCircle size={40} className="text-red-500" />
                <p className="text-red-800 font-semibold">{error || stationsError}</p>
                <button
                  onClick={() =>
                    stationsError && !error
                      ? setStationsReloadKey(k => k + 1)
                      : loadTrains(currentPage)
                  }
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
                      : 'There are no more upcoming trains for today. The service might have ended.'}
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
