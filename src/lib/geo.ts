import type { Station } from './types';

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface NearbyStation {
  station: Station;
  meters: number;
}

export function nearestStations(stations: Station[], lat: number, lon: number, limit = 3): NearbyStation[] {
  return stations
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((station) => ({ station, meters: distanceMeters(lat, lon, station.lat, station.lon) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}
