import { describe, it, expect, beforeEach } from 'bun:test';
import { run, parseRegexLiteral, RegexParseError } from '../../src/search/regex.js';

describe('regex search', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('parses /pattern/flags', () => {
    const re = parseRegexLiteral('/foo/i');
    expect(re.source).toBe('foo');
    expect(re.flags.includes('i')).toBe(true);
    expect(re.flags.includes('g')).toBe(true);
  });

  it('adds /g flag if missing (needed for iteration)', () => {
    const re = parseRegexLiteral('/foo/');
    expect(re.flags.includes('g')).toBe(true);
  });

  it('throws RegexParseError on invalid syntax', () => {
    expect(() => parseRegexLiteral('/[/')).toThrow(RegexParseError);
  });

  it('finds regex matches', () => {
    document.body.innerHTML = '<p>error123 ok error456</p>';
    const r = run('/error\\d+/g', document.body);
    expect(r.matches.length).toBe(2);
    expect(r.matches[0].value).toBe('error123');
    expect(r.matches[1].value).toBe('error456');
  });

  it('handles case-insensitive flag', () => {
    document.body.innerHTML = '<p>FOO foo Foo</p>';
    const r = run('/foo/gi', document.body);
    expect(r.matches.length).toBe(3);
  });

  it('does not infinite-loop on /$/ (zero-width)', () => {
    document.body.innerHTML = '<p>line1\nline2</p>';
    const start = Date.now();
    const r = run('/$/g', document.body);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
    // We add matches only for non-zero-width regex; $ returns 0
    expect(Array.isArray(r.matches)).toBe(true);
  });

  it('does not infinite-loop on lookahead (?=x)', () => {
    document.body.innerHTML = '<p>xxx</p>';
    const start = Date.now();
    const r = run('/(?=x)/g', document.body);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('hits the ReDoS time budget on catastrophic patterns', () => {
    // a long string of 'a' followed by 'b' with (a+)+b will backtrack catastrophically
    document.body.innerHTML = '<p>' + 'a'.repeat(30) + 'X</p>';
    const start = Date.now();
    const r = run('/(a+)+b/g', document.body);
    const elapsed = Date.now() - start;
    // Should bail within ~500ms + some slack
    expect(elapsed).toBeLessThan(2000);
  });
});
