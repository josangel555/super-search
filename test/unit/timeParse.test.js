import { describe, it, expect } from 'bun:test';
import { timeToSeconds, parseRange } from '../../src/util/timeParse.js';

describe('timeToSeconds', () => {
  it('parses MM:SS', () => {
    expect(timeToSeconds('1:30')).toBe(90);
    expect(timeToSeconds('10:30')).toBe(630);
    expect(timeToSeconds('0:00')).toBe(0);
  });
  it('parses HH:MM:SS', () => {
    expect(timeToSeconds('1:01:25')).toBe(3685);
    expect(timeToSeconds('0:01:30')).toBe(90);
  });
  it('returns NaN on bad input', () => {
    expect(Number.isNaN(timeToSeconds('abc'))).toBe(true);
    expect(Number.isNaN(timeToSeconds(''))).toBe(true);
    expect(Number.isNaN(timeToSeconds('1:2:3:4'))).toBe(true);
  });
});

describe('parseRange', () => {
  it('parses MM:SS ranges', () => {
    expect(parseRange('1:00-2:00')).toEqual({ lo: 60, hi: 120 });
  });
  it('parses HH:MM:SS ranges', () => {
    expect(parseRange('01:00:00-02:30:00')).toEqual({ lo: 3600, hi: 9000 });
  });
  it('returns null for malformed', () => {
    expect(parseRange('1:00 - 2:00')).toBeNull();
    expect(parseRange('abc')).toBeNull();
  });
});
