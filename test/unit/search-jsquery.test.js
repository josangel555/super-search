import { describe, it, expect } from 'bun:test';
import { run, JsError } from '../../src/search/jsquery.js';

describe('jsquery search', () => {
  it('returns single element for DOM element result', () => {
    document.body.innerHTML = '<p id="foo">x</p>';
    const r = run('return document.querySelector("#foo")', document.body);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].kind).toBe('js-element');
  });

  it('returns array of elements for NodeList result', () => {
    document.body.innerHTML = '<p>a</p><p>b</p>';
    const r = run('return document.querySelectorAll("p")', document.body);
    expect(r.matches.length).toBe(2);
  });

  it('returns string matches for array of strings', () => {
    const r = run('return ["alpha", "beta", "gamma"]', document.body);
    expect(r.matches.length).toBe(3);
    expect(r.matches[0].kind).toBe('js-string');
    expect(r.matches[0].value).toBe('alpha');
  });

  it('coerces primitives to string match', () => {
    const r = run('return 42', document.body);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].value).toBe('42');
  });

  it('throws JsError on bad code', () => {
    expect(() => run('this.is.a.broken.query()', document.body)).toThrow(JsError);
  });

  it('captures lastJsResult for Dump', () => {
    const r = run('return 42', document.body);
    expect(r.lastJsResult).toBe(42);
  });
});
