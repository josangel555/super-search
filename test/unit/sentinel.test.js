import { describe, it, expect, beforeEach } from 'bun:test';
import { checkSentinel, __resetSentinel } from '../../src/sentinel.js';

describe('sentinel', () => {
  beforeEach(() => __resetSentinel());

  it('returns alreadyLoaded=false on first call', () => {
    const r = checkSentinel();
    expect(r.alreadyLoaded).toBe(false);
  });

  it('returns alreadyLoaded=true on second call', () => {
    checkSentinel();
    const r = checkSentinel();
    expect(r.alreadyLoaded).toBe(true);
  });

  it('does not expose a discoverable Symbol.for key', () => {
    checkSentinel();
    // Host page should not be able to find us via cross-realm symbol registry.
    expect(globalThis[Symbol.for('super-search.loaded')]).toBeUndefined();
  });

  it('marker has no enumerable info', () => {
    __resetSentinel();
    checkSentinel();
    // Iterate own keys; should not surface our marker as the kind of obvious
    // string a fingerprinting script would look for.
    const ownKeys = Object.keys(globalThis);
    const leaky = ownKeys.find(k => /super.?search|ss.?loaded|bootedAt/i.test(k));
    expect(leaky).toBeUndefined();
  });
});
