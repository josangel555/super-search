import { describe, it, expect, beforeEach } from 'bun:test';
import { checkSentinel } from '../../src/sentinel.js';

describe('sentinel', () => {
  beforeEach(() => {
    delete globalThis[Symbol.for('super-search.loaded')];
  });

  it('returns alreadyLoaded=false on first call', () => {
    const r = checkSentinel();
    expect(r.alreadyLoaded).toBe(false);
  });

  it('returns alreadyLoaded=true on second call', () => {
    checkSentinel();
    const r = checkSentinel();
    expect(r.alreadyLoaded).toBe(true);
    expect(r.info?.version).toBeDefined();
  });
});
