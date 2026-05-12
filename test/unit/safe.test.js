import { describe, it, expect } from 'bun:test';
import { safe } from '../../src/safe.js';

describe('safe', () => {
  it('freezes built-in references', () => {
    expect(Object.isFrozen(safe)).toBe(true);
  });

  it('provides core constructors', () => {
    expect(safe.Array).toBe(Array);
    expect(safe.Object).toBe(Object);
    expect(safe.JSON).toBe(JSON);
    expect(safe.RegExp).toBe(RegExp);
    expect(safe.Date).toBe(Date);
  });

  it('survives host page Array tampering', () => {
    const orig = Array.from;
    try {
      // Simulate a hostile page overriding Array.from
      Array.from = () => 'pwned';
      expect(safe.arrayFrom([1, 2, 3])).toEqual([1, 2, 3]);
    } finally {
      Array.from = orig;
    }
  });

  it('bound JSON helpers work', () => {
    expect(safe.jsonStringify({ a: 1 })).toBe('{"a":1}');
    expect(safe.jsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('exposes timing primitives', () => {
    expect(typeof safe.setTimeout).toBe('function');
    expect(typeof safe.clearTimeout).toBe('function');
    expect(typeof safe.dateNow).toBe('function');
    expect(safe.dateNow() > 0).toBe(true);
  });
});
