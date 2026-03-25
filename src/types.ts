export interface FGCJourney {
  stop_id: string;
  stop_name: string;
  arrival_time: string;
  departure_time: string;
  trip_headsign: string;
  route_short_name: string;
  route_color: string;
  date: string;
  stop_lat: number;
  stop_lon: number;
  wheelchair_accessible?: number;
}

export interface FGCApiResponse {
  total_count: number;
  results: FGCJourney[];
}

export interface Station {
  id: string;
  name: string;
}

export const STATIONS: Station[] = [
  { id: 'ML2', name: 'Molí Nou - Ciutat Cooperativa' },
  { id: 'ES', name: 'Barcelona - Plaça Espanya' },
  { id: 'MG', name: 'Magòria - La Campana' },
  { id: 'IL', name: 'Ildefons Cerdà' },
  { id: 'EU', name: 'Europa | Fira' },
  { id: 'GV', name: 'Gornal' },
  { id: 'ST', name: 'Sant Josep' },
  { id: 'AV', name: 'L\'Hospitalet - Av. Carrilet' },
  { id: 'AL', name: 'Almeda' },
  { id: 'CO', name: 'Cornellà Riera' },
  { id: 'SJ', name: 'Sant Boi' }
];

export const DESTINATIONS = {
  TO_BARCELONA: 'Barcelona - Plaça Espanya',
  TO_MOLI_NOU: 'Molí Nou'
};
