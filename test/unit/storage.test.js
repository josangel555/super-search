import { describe, it, expect, beforeEach } from 'bun:test';
import * as storage from '../../src/storage.js';

describe('storage', () => {
  beforeEach(() => {
    globalThis.__resetGM?.();
    storage.init();
  });

  it('round-trips a value', () => {
    storage.writeUi({ width: 500 });
    const r = storage.readAll();
    expect(r.ui.width).toBe(500);
  });

  it('caps historical at MAX_ENTRIES', () => {
    const big = Array.from({ length: 1500 }, (_, i) => ({ id: 'm_' + i, capturedAt: i }));
    storage.writeHistorical(big);
    const r = storage.readAll();
    expect(r.historical.length).toBeLessThanOrEqual(1000);
  });

  it('returns sane defaults when keys missing', () => {
    globalThis.__resetGM?.();
    const r = storage.readAll();
    expect(r.historical).toEqual([]);
    expect(r.logEntries).toEqual([]);
    expect(r.firstRunDone).toBe(false);
  });
});

describe('mergeHistorical', () => {
  it('unions by id', () => {
    const a = [{ id: 'a', capturedAt: 1 }, { id: 'b', capturedAt: 2 }];
    const b = [{ id: 'b', capturedAt: 2 }, { id: 'c', capturedAt: 3 }];
    const out = storage.mergeHistorical(a, b);
    expect(out.map(m => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('respects clearedAt tombstone', () => {
    const a = [{ id: 'old', capturedAt: 5 }, { id: 'new', capturedAt: 50 }];
    const out = storage.mergeHistorical(a, [], 10);
    expect(out.map(m => m.id)).toEqual(['new']);
  });

  it('caps at MAX_ENTRIES preserving newest', () => {
    const a = Array.from({ length: 1200 }, (_, i) => ({ id: 'm_' + i, capturedAt: i }));
    const out = storage.mergeHistorical(a, []);
    expect(out.length).toBeLessThanOrEqual(1000);
    // newest preserved
    expect(out[out.length - 1].id).toBe('m_1199');
  });

  it('handles undefined inputs', () => {
    expect(storage.mergeHistorical()).toEqual([]);
    expect(storage.mergeHistorical(null, null)).toEqual([]);
  });
});
