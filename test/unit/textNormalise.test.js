import { describe, it, expect } from 'bun:test';
import { normaliseForMatch, normaliseQuery } from '../../src/util/textNormalise.js';

describe('textNormalise', () => {
  it('passes plain ASCII through unchanged', () => {
    const r = normaliseForMatch('hello world');
    expect(r.normalised).toBe('hello world');
    expect(r.indexMap.length).toBe(11);
  });

  it('converts NBSP to regular space', () => {
    const r = normaliseForMatch('Media Advisor');
    expect(r.normalised).toBe('Media Advisor');
    expect(r.indexMap.length).toBe(13);
  });

  it('drops zero-width space', () => {
    const r = normaliseForMatch('hap​py');
    expect(r.normalised).toBe('happy');
    // Original index 0,1,2,4,5 (3 was the ZWSP)
    expect(r.indexMap).toEqual([0, 1, 2, 4, 5]);
  });

  it('drops soft hyphen', () => {
    const r = normaliseForMatch('encyclo­pedia');
    expect(r.normalised).toBe('encyclopedia');
  });

  it('normaliseQuery applies the same transforms', () => {
    expect(normaliseQuery('Media Advisor')).toBe('Media Advisor');
    expect(normaliseQuery('a​b')).toBe('ab');
  });

  it('handles empty input', () => {
    const r = normaliseForMatch('');
    expect(r.normalised).toBe('');
    expect(r.indexMap).toEqual([]);
  });
});
