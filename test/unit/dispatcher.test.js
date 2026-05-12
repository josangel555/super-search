import { describe, it, expect } from 'bun:test';
import { detectTextSubmode, dispatch } from '../../src/search/dispatcher.js';

describe('dispatcher.detectTextSubmode', () => {
  it('detects plain text', () => {
    expect(detectTextSubmode('hello')).toBe('plain');
    expect(detectTextSubmode('hello world')).toBe('plain');
  });

  it('detects regex literal', () => {
    expect(detectTextSubmode('/foo/')).toBe('regex');
    expect(detectTextSubmode('/foo/i')).toBe('regex');
    expect(detectTextSubmode('/\\d+/gi')).toBe('regex');
  });

  it('detects timestamp range', () => {
    expect(detectTextSubmode('1:00-2:00')).toBe('timestamp');
    expect(detectTextSubmode('01:00:00-02:30:00')).toBe('timestamp');
  });

  it('does NOT treat strings containing slashes as regex', () => {
    expect(detectTextSubmode('not/a/regex')).toBe('plain');
    expect(detectTextSubmode('/foo')).toBe('plain');
  });

  it('strict timestamp matching (no extra whitespace)', () => {
    expect(detectTextSubmode('1:00 - 2:00')).toBe('plain');
  });

  it('returns empty for empty', () => {
    expect(detectTextSubmode('')).toBe('empty');
  });
});

describe('dispatcher.dispatch', () => {
  it('returns empty matches for empty query', () => {
    const r = dispatch({ query: '', mode: 'text', root: document.body });
    expect(r.matches).toEqual([]);
    expect(r.submode).toBe('empty');
  });

  it('runs text search for plain query', () => {
    document.body.innerHTML = '<p>Lorem ipsum dolor</p>';
    const r = dispatch({ query: 'lorem', mode: 'text', root: document.body, sourceUrl: 'http://t.example/' });
    expect(r.matches.length).toBe(1);
    expect(r.submode).toBe('plain');
    expect(r.error).toBeNull();
  });

  it('runs regex on /pattern/ query', () => {
    document.body.innerHTML = '<p>foo bar foo baz</p>';
    const r = dispatch({ query: '/foo/g', mode: 'text', root: document.body });
    expect(r.matches.length).toBe(2);
    expect(r.submode).toBe('regex');
  });

  it('flags invalid regex without throwing', () => {
    document.body.innerHTML = '<p>x</p>';
    const r = dispatch({ query: '/[/', mode: 'text', root: document.body });
    expect(r.error).toBe('regex');
    expect(r.matches).toEqual([]);
  });
});
