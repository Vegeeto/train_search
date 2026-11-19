import { terminatesAt } from './departures';
import type { Journey, StopTime } from './types';

/**
 * Direct trains from one station to another.
 *
 * Today's timetable has no trip_id, so the two ends of each ride have to be paired.
 * Ride time alone can't do it: on a line with a train every 6 minutes and a 12-minute
 * ride, "the first arrival at B after leaving A" is the *previous* train, and with a
 * regular timetable every offset of one headway looks equally consistent.
 *
 * What the data does give us (verified live):
 *  - (line, shape_id, headsign) is one stopping pattern in one direction, and trains on
 *    it never overtake each other;
 *  - within that, all trains from the same origin have the same stop_sequence at a given
 *    station — so splitting each end by stop_sequence yields matching cohorts of trains
 *    (e.g. 119 departures ↔ 119 arrivals), in the same order at both ends.
 *
 * So for each origin cohort (A, seq s) and destination cohort (B, seq s' > s):
 *  1. find the order alignment (index offset) that pairs the most trains with a
 *     near-constant ride time — that ride time is the typical one;
 *  2. pair trains in order, each departure taking the arrival closest to the typical
 *     ride time within a tolerance. This copes with a few trains that skip B.
 */

interface Cohort {
  key: string;
  rows: StopTime[];
}

const tolerance = (ride: number) => Math.max(120, ride * 0.12);

function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)];
}

/** Typical ride time between two cohorts, or null if no alignment is convincing. */
export function typicalRide(from: StopTime[], to: StopTime[]): number | null {
  let best: { inliers: number; spread: number; offset: number; ride: number } | null = null;
  for (let offset = -(from.length - 1); offset <= to.length - 1; offset++) {
    const rides: number[] = [];
    for (let i = Math.max(0, -offset); i < from.length && i + offset < to.length; i++) {
      const ride = to[i + offset].arrival - from[i].departure;
      if (ride > 0) rides.push(ride);
    }
    if (!rides.length) continue;
    rides.sort((x, y) => x - y);
    const ride = median(rides);
    const inside = rides.filter((r) => Math.abs(r - ride) <= tolerance(ride));
    const spread = inside[inside.length - 1] - inside[0];
    const better =
      !best ||
      inside.length > best.inliers ||
      (inside.length === best.inliers && (spread < best.spread || (spread === best.spread && Math.abs(offset) < Math.abs(best.offset))));
    if (better) best = { inliers: inside.length, spread, offset, ride };
  }
  return best && best.inliers > 0 ? best.ride : null;
}

function pairCohorts(from: StopTime[], to: StopTime[]): Journey[] {
  const ride = typicalRide(from, to);
  if (ride === null) return [];
  const tol = tolerance(ride);
  const pairs: Journey[] = [];
  let lastUsed = -1;
  for (const a of from) {
    let pick = -1;
    let pickDeviation = Infinity;
    for (let j = lastUsed + 1; j < to.length && to[j].arrival - a.departure <= ride + tol; j++) {
      const deviation = Math.abs(to[j].arrival - a.departure - ride);
      if (deviation <= tol && deviation < pickDeviation) {
        pick = j;
        pickDeviation = deviation;
      }
    }
    if (pick === -1) continue;
    pairs.push({ stop: a, arrival: to[pick], duration: to[pick].arrival - a.departure, isLast: false });
    lastUsed = pick;
  }
  return pairs;
}

function cohorts(rows: StopTime[], time: (r: StopTime) => number): Map<string, Cohort[]> {
  const byPattern = new Map<string, Map<number, StopTime[]>>();
  for (const r of rows) {
    const pattern = `${r.line}|${r.shapeId}|${r.headsign}`;
    let bySeq = byPattern.get(pattern);
    if (!bySeq) byPattern.set(pattern, (bySeq = new Map()));
    let list = bySeq.get(r.sequence);
    if (!list) bySeq.set(r.sequence, (list = []));
    list.push(r);
  }
  const result = new Map<string, Cohort[]>();
  for (const [pattern, bySeq] of byPattern) {
    result.set(
      pattern,
      [...bySeq.entries()].map(([seq, list]) => ({ key: String(seq), rows: list.sort((x, y) => time(x) - time(y)) })),
    );
  }
  return result;
}

export function directJourneys(rows: StopTime[], fromName: string, toName: string): Journey[] {
  if (fromName === toName) return [];

  const origins = cohorts(
    rows.filter((r) => r.stationName === fromName && !terminatesAt(r, fromName)),
    (r) => r.departure,
  );
  const destinations = cohorts(
    rows.filter((r) => r.stationName === toName),
    (r) => r.arrival,
  );

  // Candidate pairings from every compatible cohort pair, biggest first, then de-duplicated
  // so each departure and each arrival is used at most once.
  const candidates: Journey[][] = [];
  for (const [pattern, fromCohorts] of origins) {
    const toCohorts = destinations.get(pattern);
    if (!toCohorts) continue;
    for (const a of fromCohorts) {
      for (const b of toCohorts) {
        if (Number(b.key) <= Number(a.key)) continue; // wrong direction
        const pairs = pairCohorts(a.rows, b.rows);
        if (pairs.length) candidates.push(pairs);
      }
    }
  }
  candidates.sort((x, y) => y.length - x.length);

  const usedFrom = new Set<StopTime>();
  const usedTo = new Set<StopTime>();
  const journeys: Journey[] = [];
  for (const pairs of candidates) {
    for (const j of pairs) {
      if (usedFrom.has(j.stop) || usedTo.has(j.arrival)) continue;
      usedFrom.add(j.stop);
      usedTo.add(j.arrival);
      journeys.push(j);
    }
  }

  journeys.sort((x, y) => x.stop.departure - y.stop.departure || x.duration - y.duration);
  if (journeys.length) journeys[journeys.length - 1].isLast = true;
  return journeys;
}
