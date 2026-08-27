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
  stop_sequence?: number;
  is_last_train?: boolean;
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

export const DIRECTIONS = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND'
};

export const ROUTES = [
  {
    name: 'Llobregat-Anoia',
    url: 'http://www.fgc.cat/cat/llobregat-anoia.asp',
    terminal: 'Barcelona - Plaça Espanya',
    trainTypes: ['L8', 'R5', 'R53', 'R6', 'R63', 'S3', 'S4', 'S8'],
  },
  {
    name: 'Barcelona-Vallès',
    url: 'http://www.fgc.cat/cat/barcelona-valles.asp',
    // Must match the dataset verbatim: `terminal` is used both as a stop_name and
    // as a trip_headsign in the ODSQL filters. The abbreviated "Pl. Catalunya"
    // used previously exists nowhere in the data, which zeroed out every INBOUND
    // query on this network.
    terminal: 'Barcelona - Plaça Catalunya',
    trainTypes: ['FV', 'L12', 'L6', 'L7', 'S1', 'S2'],
  },
  {
    name: 'Lleida-La Pobla',
    url: 'http://www.fgc.cat/cat/lleida-la-pobla.asp',
    // The dataset calls this stop simply "Lleida" (both stop_name and headsign);
    // "Lleida Pirineus" matches nothing.
    terminal: 'Lleida',
    trainTypes: ['RL1', 'RL2'],
    // This line's records carry route_url=null in the FGC dataset (no dedicated page on
    // fgc.cat), so it can't be matched with the `route_url like` slug used by the other
    // routes. route_long_name is the only reliable identifier for it.
    routeLongName: 'Lleida - La Pobla',
  },
];
