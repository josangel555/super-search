import { describe, it, expect, beforeEach } from 'bun:test';
import { buildLogEntry, logMatches, resetSessionDedupe } from '../../src/logging.js';

describe('logging', () => {
  beforeEach(() => resetSessionDedupe());

  it('builds a log entry from a match', () => {
    const e = buildLogEntry({ kind: 'text', value: 'foo', before: 'x', after: 'y', sourceUrl: 'u' });
    expect(e.value).toBe('foo');
    expect(e.kind).toBe('text');
    expect(e.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('dedupes by value+before+after+url within a session', () => {
    const m = { kind: 'text', value: 'foo', before: '', after: '', sourceUrl: 'u' };
    expect(logMatches([m]).length).toBe(1);
    expect(logMatches([m]).length).toBe(0);
    resetSessionDedupe();
    expect(logMatches([m]).length).toBe(1);
  });

  it('treats different urls as different entries', () => {
    const m1 = { kind: 'text', value: 'foo', before: '', after: '', sourceUrl: 'u1' };
    const m2 = { kind: 'text', value: 'foo', before: '', after: '', sourceUrl: 'u2' };
    expect(logMatches([m1, m2]).length).toBe(2);
  });
});
