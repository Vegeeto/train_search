/** A line (GTFS route_short_name) as it appears in the timetable. */
export interface Line {
  name: string;
  /** CSS colour, always `#rrggbb`. */
  color: string;
  /** Black or white, whichever reads better on `color`. */
  textColor: string;
}

/** One physical station (all platforms merged). */
export interface Station {
  /** Two-letter FGC station code (GTFS parent_station), e.g. `PC`. Stable across days. */
  code: string;
  name: string;
  lat: number;
  lon: number;
  lines: Line[];
  /** At least one platform reports wheelchair boarding. */
  accessible: boolean;
}

/** One scheduled stop of one train at one station, from today's timetable. */
export interface StopTime {
  date: string;
  stationName: string;
  stopId: string;
  line: string;
  color: string;
  textColor: string;
  headsign: string;
  /** Seconds after the service day's midnight. Can exceed 86 400 for after-midnight trains. */
  arrival: number;
  departure: number;
  sequence: number;
  shapeId: number;
  platform: string | null;
}

export type OccupancyLevel = 1 | 2 | 3;

export interface Occupancy {
  /** Per-car readings, in feed order. */
  cars: { percent: number | null; level: OccupancyLevel | null }[];
  /** Busiest car — what a passenger boarding anywhere might face. */
  level: OccupancyLevel | null;
  percent: number | null;
}

/** A train reported by FGC's live positioning feed. */
export interface LiveTrain {
  id: string;
  line: string;
  destCode: string | null;
  /** Upcoming station codes, nearest first. Does not include `atStation`. */
  nextStops: string[];
  /** Station the train is currently stopped at, if any. */
  atStation: string | null;
  onTime: boolean | null;
  occupancy: Occupancy | null;
}

/** Live information attached to a scheduled departure. */
export interface LiveStatus {
  trainId: string;
  /** 0 = at the platform now, 1 = next stop is this station, … */
  stopsAway: number;
  onTime: boolean | null;
  occupancy: Occupancy | null;
}

export interface Departure {
  stop: StopTime;
  isLast: boolean;
  live?: LiveStatus;
}

export interface Journey {
  /** Same shape as Departure so live matching applies to both. */
  stop: StopTime;
  arrival: StopTime;
  duration: number;
  isLast: boolean;
  live?: LiveStatus;
}
