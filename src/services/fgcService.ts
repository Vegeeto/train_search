import { FGCApiResponse, FGCJourney } from '../types';

const BASE_URL = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/viajes-de-hoy/records';

export const fetchTrains = async (
  stopId: string,
  destination: string,
  limit: number = 10
): Promise<FGCJourney[]> => {
  // Get current time and hours for filtering
  const now = new Date();
  const bufferTime = new Date(now.getTime() - 5 * 60000);
  const timeStr = bufferTime.toTimeString().split(' ')[0];
  
  const currentHour = now.getHours().toString().padStart(2, '0');
  const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');

  // Build the where clause using 'like' for the current and next hour
  // Note: API requires double quotes for strings and lowercase operators
  const where = `stop_id="${stopId}" and trip_headsign="${destination}" and (arrival_time like "${currentHour}:%" or arrival_time like "${nextHour}:%")`;
  
  const params = new URLSearchParams({
    where: where,
    order_by: 'arrival_time asc',
    limit: '100' // Fetch more to allow for client-side filtering
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    const data: FGCApiResponse = await response.json();
    
    // Filter results client-side to only include those after the buffer time
    const filteredResults = data.results
      .filter(journey => journey.arrival_time >= timeStr)
      .slice(0, limit);
      
    return filteredResults;
  } catch (error) {
    console.error('Error fetching FGC data:', error);
    return [];
  }
};
