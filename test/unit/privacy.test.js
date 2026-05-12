import { describe, it, expect } from 'bun:test';
import { isAllowedToPersist, hostOf } from '../../src/privacy.js';

describe('hostOf', () => {
  it('extracts hostname', () => {
    expect(hostOf('https://www.example.com/path?x=1')).toBe('www.example.com');
  });
  it('returns empty for non-URL', () => {
    expect(hostOf('not a url')).toBe('');
  });
});

describe('isAllowedToPersist', () => {
  it('returns true for empty privacy config', () => {
    expect(isAllowedToPersist({ privacy: { incognito: false, denylist: [] } }, 'https://a.com')).toBe(true);
  });
  it('returns false in incognito', () => {
    expect(isAllowedToPersist({ privacy: { incognito: true, denylist: [] } }, 'https://a.com')).toBe(false);
  });
  it('exact match denylist', () => {
    const s = { privacy: { denylist: ['bank.example.com'] } };
    expect(isAllowedToPersist(s, 'https://bank.example.com/x')).toBe(false);
    expect(isAllowedToPersist(s, 'https://other.com')).toBe(true);
  });
  it('suffix-pattern denylist (.example.com)', () => {
    const s = { privacy: { denylist: ['.example.com'] } };
    expect(isAllowedToPersist(s, 'https://a.example.com')).toBe(false);
    expect(isAllowedToPersist(s, 'https://example.com')).toBe(false);
    expect(isAllowedToPersist(s, 'https://example.org')).toBe(true);
  });
  it('wildcard denylist (*.example.com)', () => {
    const s = { privacy: { denylist: ['*.example.com'] } };
    expect(isAllowedToPersist(s, 'https://a.example.com')).toBe(false);
    expect(isAllowedToPersist(s, 'https://b.c.example.com')).toBe(false);
    expect(isAllowedToPersist(s, 'https://other.com')).toBe(true);
  });
});
