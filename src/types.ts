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
  route_url?: string;
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

export const BARCELONA_TERMINAL = 'Barcelona - Plaça Espanya';

export const DIRECTIONS = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND'
};

export const ROUTES = [
  { name: 'Llobregat-Anoia', url: 'http://www.fgc.cat/cat/llobregat-anoia.asp' },
  { name: 'Barcelona-Vallès', url: 'http://www.fgc.cat/cat/barcelona-valles.asp' },
  { name: 'Lleida-La Pobla', url: 'http://www.fgc.cat/cat/lleida-la-pobla.asp' }
];

export const TRAIN_TYPES = [
  'L8', 'S3', 'S4', 'S8', 'S9', 'R5', 'R6', 'R50', 'R60'
];
