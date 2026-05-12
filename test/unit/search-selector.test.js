import { describe, it, expect } from 'bun:test';
import { run, SelectorError } from '../../src/search/selector.js';

describe('selector search', () => {
  it('finds elements by tag', () => {
    document.body.innerHTML = '<div><p>a</p><p>b</p><span>x</span></div>';
    const r = run('p', document.body);
    expect(r.matches.length).toBe(2);
    expect(r.matches[0].kind).toBe('selector');
    expect(r.matches[0].element).not.toBeNull();
  });

  it('handles attribute selectors', () => {
    document.body.innerHTML = '<a href="https://example.com">x</a><a href="https://x.test">y</a>';
    const r = run('a[href*="example.com"]', document.body);
    expect(r.matches.length).toBe(1);
  });

  it('throws SelectorError on invalid', () => {
    document.body.innerHTML = '<p>x</p>';
    // Use a clearly invalid selector that all DOM implementations reject.
    expect(() => run('[[[bad', document.body)).toThrow(SelectorError);
  });

  it('returns [] on no match', () => {
    document.body.innerHTML = '<p>x</p>';
    const r = run('div.does-not-exist', document.body);
    expect(r.matches.length).toBe(0);
  });
});
