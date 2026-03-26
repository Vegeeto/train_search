import { FGCApiResponse, FGCJourney, BARCELONA_TERMINAL, DIRECTIONS } from '../types';

const BASE_URL = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/viajes-de-hoy/records';

export const fetchTrains = async (
  stopId: string,
  direction: string,
  limit: number = 10,
  offset: number = 0,
  selectedHour?: string,
  routeShortNames?: string[],
  routeUrl?: string
): Promise<{ results: FGCJourney[]; totalCount: number }> => {
  let where = stopId === 'ES' ? 'stop_sequence=1' : `stop_id="${stopId}"`;
  
  // If we are at the terminal station (Plaça Espanya), we can only go outbound.
  // We use != to show all trains departing from this station.
  if (stopId === 'ES') {
    where += ` and trip_headsign!="${BARCELONA_TERMINAL}"`;
  } else if (direction === DIRECTIONS.INBOUND) {
    where += ` and trip_headsign="${BARCELONA_TERMINAL}"`;
  } else {
    where += ` and trip_headsign!="${BARCELONA_TERMINAL}"`;
  }

  if (routeShortNames && routeShortNames.length > 0) {
    const types = routeShortNames.map(name => `"${name}"`).join(',');
    where += ` and route_short_name in (${types})`;
  }

  if (routeUrl) {
    where += ` and route_url like "${routeUrl}"`;
  }

  const now = new Date();
  const bufferTime = new Date(now.getTime() - 5 * 60000);
  const timeStr = bufferTime.toTimeString().split(' ')[0];

  if (selectedHour) {
    // If a specific hour is selected, query only for that hour
    where += ` and arrival_time like "${selectedHour.padStart(2, '0')}:%"`;
  } else {
    // Default "Now" logic: current and next hour
    const currentHour = now.getHours().toString().padStart(2, '0');
    const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
    where += ` and (arrival_time like "${currentHour}:%" or arrival_time like "${nextHour}:%")`;
  }
  
  const params = new URLSearchParams({
    where: where,
    order_by: 'arrival_time asc',
    limit: '100', // Fetch a larger batch to allow for client-side filtering
    offset: '0'   // We handle pagination client-side on the filtered set for simplicity
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.debug('Fetching data: ', url)

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    const data: FGCApiResponse = await response.json();
    console.debug('Total results: ', data.total_count)

    // Filter results client-side
    // If no hour selected, filter by current time. If hour selected, show all for that hour.
    const filteredResults = data.results.filter(journey => {
      if (selectedHour) return true;
      return journey.arrival_time >= timeStr;
    });
      
    const paginatedResults = filteredResults.slice(offset, offset + limit);
    
    return {
      results: paginatedResults,
      totalCount: filteredResults.length
    };
  } catch (error) {
    console.error('Error fetching FGC data:', error);
    return { results: [], totalCount: 0 };
  }
};
