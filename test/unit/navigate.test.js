import { describe, it, expect } from 'bun:test';
import { nextIndex, prevIndex } from '../../src/navigate.js';

describe('navigate index math', () => {
  it('next wraps at end', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it('prev wraps at start', () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(1, 3)).toBe(0);
  });
  it('handles empty match list', () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
  });
});
