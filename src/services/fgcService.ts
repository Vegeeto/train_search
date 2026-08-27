import { FGCApiResponse, FGCJourney, DIRECTIONS } from '../types';

const BASE_URL = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/viajes-de-hoy/records';

const isDebug = process.env.APP_DEBUG === 'true';
const debugLog = (...args: unknown[]) => { if (isDebug) console.log('[FGC]', ...args); };

// Opendatasoft's ODSQL string literals use backslash-escaping for embedded quotes
// (confirmed against the live API — station names like "L'Hospitalet Av. Carrilet"
// need this or the query silently matches nothing).
const escapeODSQL = (value: string) => value.replace(/'/g, "\\'");

// Builds the clause that scopes results to one route network. Every line except
// Lleida-La Pobla shares a route_url slug across its sub-lines; Lleida-La Pobla's
// records have route_url=null, so it's matched by route_long_name instead.
const routeWhereClause = (routeUrl?: string, routeLongName?: string): string | null => {
  if (routeLongName) {
    return `route_long_name='${escapeODSQL(routeLongName)}'`;
  }
  if (routeUrl) {
    const slug = routeUrl.split('/').pop()?.replace('.asp', '') || '';
    return `route_url like '*${escapeODSQL(slug)}*'`;
  }
  return null;
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Opendatasoft only supports `like` for time-string matching (no >= / <= on strings),
// so the whole hour window is pulled down and narrowed client-side. `limit` is capped
// at 100 by the API, and a two-hour window at a multi-platform hub can exceed that, so
// the pages are walked with `offset` until everything is retrieved. MAX_ROWS is a
// safety stop — a single stop/two-hour window never comes close to it.
const API_PAGE_SIZE = 100;
const MAX_ROWS = 500;

const fetchAllRows = async (where: string): Promise<FGCJourney[]> => {
  const rows: FGCJourney[] = [];
  let totalCount = Infinity;

  for (let offset = 0; offset < Math.min(totalCount, MAX_ROWS); offset += API_PAGE_SIZE) {
    const params = new URLSearchParams({
      where,
      order_by: 'arrival_time asc',
      limit: String(API_PAGE_SIZE),
      offset: String(offset),
    });
    const url = `${BASE_URL}?${params.toString()}`;
    debugLog('fetchTrains url:', url);

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    const data: FGCApiResponse = await response.json();
    debugLog('fetchTrains response:', data);

    rows.push(...data.results);
    totalCount = typeof data.total_count === 'number' ? data.total_count : rows.length;
    if (data.results.length < API_PAGE_SIZE) break;
  }

  if (totalCount > MAX_ROWS) {
    console.warn(`FGC query returned ${totalCount} rows; only the first ${MAX_ROWS} were read.`);
  }

  return rows;
};

export const fetchTrains = async (
  stationName: string,
  direction: string,
  limit: number = 10,
  offset: number = 0,
  selectedHour?: string,
  routeShortNames?: string[],
  routeUrl?: string,
  terminalName: string = 'Barcelona - Plaça Espanya',
  routeLongName?: string
): Promise<{ results: FGCJourney[]; totalCount: number }> => {
  // Query by stop_name rather than stop_id: hub stations (e.g. Barcelona - Plaça Espanya,
  // Barcelona - Pl. Catalunya) are split across several stop_ids, one per platform, each
  // carrying different trains. Filtering by name captures all of them in one query.
  let where = `stop_name='${escapeODSQL(stationName)}'`;

  if (stationName === terminalName) {
    // At the terminal there's only one meaningful direction: outbound.
    where += ` and trip_headsign!='${escapeODSQL(terminalName)}'`;
  } else if (direction === DIRECTIONS.INBOUND) {
    where += ` and trip_headsign='${escapeODSQL(terminalName)}'`;
  } else {
    where += ` and trip_headsign!='${escapeODSQL(terminalName)}'`;
  }

  if (routeShortNames && routeShortNames.length > 0) {
    const types = routeShortNames.map(name => `'${escapeODSQL(name)}'`).join(',');
    where += ` and route_short_name in (${types})`;
  }

  const routeClause = routeWhereClause(routeUrl, routeLongName);
  if (routeClause) {
    where += ` and ${routeClause}`;
  }

  const baseWhere = where; // Save base where for last train check

  const now = new Date();
  const bufferTime = new Date(now.getTime() - 5 * 60000);
  const timeStr = bufferTime.toTimeString().split(' ')[0];

  if (selectedHour) {
    // If a specific hour is selected, query only for that hour
    where += ` and arrival_time like '${selectedHour.padStart(2, '0')}:%'`;
  } else {
    // Default "Now" logic: current and next hour
    const currentHour = now.getHours().toString().padStart(2, '0');
    const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
    where += ` and (arrival_time like '${currentHour}:%' or arrival_time like '${nextHour}:%')`;
  }
  
  try {
    const rows = await fetchAllRows(where);
    debugLog('fetchTrains rows:', rows.length);

    // Identify the last train of the day to inform the user
    let lastTrainOfDay: FGCJourney | null = null;
    try {
      const lastTrainParams = new URLSearchParams({
        where: baseWhere,
        order_by: 'arrival_time desc',
        limit: '1'
      });
      const lastTrainUrl = `${BASE_URL}?${lastTrainParams.toString()}`;
      debugLog('fetchTrains last-train url:', lastTrainUrl);
      const lastTrainRes = await fetchWithTimeout(lastTrainUrl);
      if (lastTrainRes.ok) {
        const lastTrainData: FGCApiResponse = await lastTrainRes.json();
        debugLog('fetchTrains last-train response:', lastTrainData);
        if (lastTrainData.results.length > 0) {
          lastTrainOfDay = lastTrainData.results[0];
        }
      }
    } catch (e) {
      console.warn('Failed to fetch last train of the day info');
    }

    // Helper to parse "HH:MM:SS" into a Date object for today
    const parseTimeToDate = (timeStr: string) => {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, seconds || 0, 0);
      return date;
    };

    // Filter results client-side
    const filteredResults = rows.map(journey => {
      // Mark if it's the last train of the day
      if (lastTrainOfDay && 
          journey.arrival_time === lastTrainOfDay.arrival_time && 
          journey.trip_headsign === lastTrainOfDay.trip_headsign &&
          journey.route_short_name === lastTrainOfDay.route_short_name) {
        return { ...journey, is_last_train: true };
      }
      return journey;
    }).filter(journey => {
      const arrivalDate = parseTimeToDate(journey.arrival_time);

      if (selectedHour) {
        // Range for selected hour: [hour:00, (hour+1):00). setHours(24) rolls over
        // to midnight of the next day on its own, so hour 23 needs no special case.
        const start = new Date();
        start.setHours(Number(selectedHour), 0, 0, 0);
        const end = new Date();
        end.setHours(Number(selectedHour) + 1, 0, 0, 0);

        return arrivalDate >= start && arrivalDate < end;
      }
      
      // Default "Now" logic: from bufferTime onwards
      return arrivalDate >= bufferTime;
    });
      
    const paginatedResults = filteredResults.slice(offset, offset + limit);
    
    return {
      results: paginatedResults,
      totalCount: filteredResults.length
    };
  } catch (error) {
    console.error('Error fetching FGC data:', error);
    throw error;
  }
};

export const fetchStations = async (
  routeUrl: string,
  routeLongName?: string
): Promise<{ id: string; name: string }[]> => {
  // As per API error: Aggregates are deprecated in 2.1.
  // We must use /records with group_by instead.
  const where = routeWhereClause(routeUrl, routeLongName) || '';
  const params = new URLSearchParams({
    group_by: 'stop_id, stop_name',
    select: 'stop_id, stop_name',
    where,
    limit: '100'
  });

  const url = `${BASE_URL}?${params.toString()}`;
  debugLog('fetchStations url:', url);

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    debugLog('fetchStations response:', data);

    const results = data.results || data.aggregations || [];
    debugLog(`fetchStations: ${results.length} raw records for where "${where}"`);

    if (results.length === 0) {
      console.warn('No stations found for where clause:', where);
      return [];
    }

    // Sort by stop_id before deduplication so the lexicographically smallest ID is
    // always selected when a station has multiple stop_ids (different platforms).
    const sorted = [...results].sort((a: any, b: any) =>
      (a.stop_id || '').localeCompare(b.stop_id || '')
    );
    const stationMap = new Map<string, { id: string; name: string }>();
    sorted.forEach((r: any) => {
      if (r.stop_id && r.stop_name && !stationMap.has(r.stop_name)) {
        stationMap.set(r.stop_name, { id: r.stop_id, name: r.stop_name });
      }
    });

    const stations = Array.from(stationMap.values());
    debugLog(`fetchStations: ${stations.length} unique stations for where "${where}"`);

    // Sort alphabetically
    return stations.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};
