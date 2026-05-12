import { describe, it, expect, beforeEach } from 'bun:test';
import { run } from '../../src/search/text.js';

describe('text search', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds plain matches case-insensitive', () => {
    document.body.innerHTML = '<p>Lorem ipsum LOREM</p>';
    const r = run('lorem', document.body, { sourceUrl: 'u' });
    expect(r.matches.length).toBe(2);
    expect(r.matches[0].kind).toBe('text');
  });

  it('matches across NBSP', () => {
    document.body.innerHTML = '<p>Media Advisor</p>';
    const r = run('Media Advisor', document.body);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].value).toBe('Media Advisor');
  });

  it('matches across zero-width space', () => {
    document.body.innerHTML = '<p>hap​py</p>';
    const r = run('happy', document.body);
    expect(r.matches.length).toBe(1);
  });

  it('skips <script> contents', () => {
    document.body.innerHTML = '<script>const lorem = 1;</script><p>plain text</p>';
    const r = run('lorem', document.body);
    expect(r.matches.length).toBe(0);
  });

  it('skips <style> contents', () => {
    document.body.innerHTML = '<style>.lorem { color: red; }</style><p>plain</p>';
    const r = run('lorem', document.body);
    expect(r.matches.length).toBe(0);
  });

  it('finds overlapping but non-overlapping occurrences', () => {
    document.body.innerHTML = '<p>aaaa</p>';
    const r = run('aa', document.body);
    expect(r.matches.length).toBe(2);
  });

  it('returns empty for empty query', () => {
    document.body.innerHTML = '<p>hello</p>';
    const r = run('', document.body);
    expect(r.matches.length).toBe(0);
  });

  it('builds context snippets', () => {
    document.body.innerHTML = '<p>The quick brown fox jumps over the lazy dog</p>';
    const r = run('fox', document.body);
    expect(r.matches[0].before).toContain('brown');
    expect(r.matches[0].after).toContain('jumps');
  });

  it('content-derived ids are stable for identical content', () => {
    document.body.innerHTML = '<p>foo</p><p>foo</p>';
    const r = run('foo', document.body, { sourceUrl: 'u' });
    // Same value/context/url → same id (this is desired for dedupe).
    expect(r.matches[0].id).toBe(r.matches[1].id);
  });
});
