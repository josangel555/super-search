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

  it('refuses catastrophic (X+)+ patterns up-front', () => {
    document.body.innerHTML = '<p>aaa</p>';
    expect(() => run('/(a+)+b/g', document.body)).toThrow(RegexParseError);
  });

  it('refuses (.+)+ patterns', () => {
    document.body.innerHTML = '<p>aaa</p>';
    expect(() => run('/(.+)+x/g', document.body)).toThrow(RegexParseError);
  });

  it('allows benign patterns with single quantifier', () => {
    document.body.innerHTML = '<p>foo bar foo</p>';
    const r = run('/foo/g', document.body);
    expect(r.matches.length).toBe(2);
  });

  it('allows alternation without nested quantifiers', () => {
    document.body.innerHTML = '<p>cat dog cat</p>';
    const r = run('/(cat|dog)/g', document.body);
    expect(r.matches.length).toBe(3);
  });
});
