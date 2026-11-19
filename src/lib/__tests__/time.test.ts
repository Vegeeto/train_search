import { describe, expect, it } from 'vitest';
import { addDays, formatClock, madridNow, minutesUntil, parseGtfsTime, pickedTimeToSeconds, serviceSeconds } from '../time';

describe('parseGtfsTime', () => {
  it('parses normal and after-midnight GTFS times', () => {
    expect(parseGtfsTime('08:05:30')).toBe(8 * 3600 + 5 * 60 + 30);
    expect(parseGtfsTime('24:54:00')).toBe(24 * 3600 + 54 * 60);
    expect(parseGtfsTime('7:00')).toBe(7 * 3600);
  });

  it('returns NaN for malformed input', () => {
    expect(parseGtfsTime('')).toBeNaN();
    expect(parseGtfsTime(null)).toBeNaN();
    expect(parseGtfsTime('8h05')).toBeNaN();
  });
});

describe('formatClock', () => {
  it('wraps after-midnight service times to wall-clock', () => {
    expect(formatClock(parseGtfsTime('24:10:00'))).toBe('00:10');
    expect(formatClock(parseGtfsTime('08:05:59'))).toBe('08:05');
  });
});

describe('madridNow', () => {
  it('uses Europe/Madrid regardless of the viewer timezone', () => {
    // 2026-11-19 23:30 UTC is 00:30 on the 20th in Madrid (CET, UTC+1).
    expect(madridNow(new Date('2026-11-19T23:30:00Z'))).toEqual({ date: '2026-11-20', seconds: 30 * 60 });
    // Summer time (CEST, UTC+2).
    expect(madridNow(new Date('2026-07-01T06:00:00Z'))).toEqual({ date: '2026-07-01', seconds: 8 * 3600 });
  });
});

describe('serviceSeconds', () => {
  it('is plain time when the dataset is for today', () => {
    expect(serviceSeconds({ date: '2026-11-19', seconds: 3600 }, '2026-11-19')).toBe(3600);
  });

  it('continues past 24:00 while the dataset is still yesterday’s service day', () => {
    expect(serviceSeconds({ date: '2026-11-20', seconds: 1800 }, '2026-11-19')).toBe(86_400 + 1800);
  });

  it('falls back to plain time when the service date is unknown', () => {
    expect(serviceSeconds({ date: '2026-11-20', seconds: 1800 }, undefined)).toBe(1800);
  });
});

describe('pickedTimeToSeconds', () => {
  it('treats small hours as the tail of the service day', () => {
    expect(pickedTimeToSeconds('00:30')).toBe(24 * 3600 + 30 * 60);
    expect(pickedTimeToSeconds('08:30')).toBe(8 * 3600 + 30 * 60);
  });
});

describe('helpers', () => {
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('minutesUntil never goes negative', () => {
    expect(minutesUntil(1000, 1200)).toBe(0);
    expect(minutesUntil(1300, 1000)).toBe(5);
  });
});
