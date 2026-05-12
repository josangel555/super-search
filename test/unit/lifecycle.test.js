import { describe, it, expect, beforeEach } from 'bun:test';
import { isAlive, pruneDead, adjustIndex } from '../../src/lifecycle.js';

describe('lifecycle.isAlive', () => {
  beforeEach(() => { document.body.innerHTML = '<p id="a">hello world</p>'; });

  it('returns true for a fresh range', () => {
    const node = document.querySelector('p').firstChild;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 5);
    expect(isAlive({ range: r, capturedNodeLength: node.nodeValue.length })).toBe(true);
  });

  it('returns false when the start node is detached', () => {
    const node = document.querySelector('p').firstChild;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 5);
    document.body.innerHTML = ''; // detach
    expect(isAlive({ range: r })).toBe(false);
  });

  it('returns false when node value length changed (text mutation)', () => {
    const node = document.querySelector('p').firstChild;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 5);
    const captured = node.nodeValue.length;
    node.nodeValue = 'short';
    expect(isAlive({ range: r, capturedNodeLength: captured })).toBe(false);
  });

  it('returns true for connected element-mode match', () => {
    const el = document.querySelector('p');
    expect(isAlive({ element: el })).toBe(true);
  });

  it('returns false for detached element', () => {
    const el = document.querySelector('p');
    el.remove();
    expect(isAlive({ element: el })).toBe(false);
  });

  it('returns true for js-string', () => {
    expect(isAlive({ kind: 'js-string', value: 'x' })).toBe(true);
  });
});

describe('pruneDead', () => {
  it('removes dead matches', () => {
    document.body.innerHTML = '<p>a</p>';
    const el = document.querySelector('p');
    const alive = { element: el };
    const dead = { element: document.createElement('div') };  // never inserted
    expect(pruneDead([alive, dead]).length).toBe(1);
  });
});

describe('adjustIndex', () => {
  it('clamps to last valid index when list shrinks', () => {
    expect(adjustIndex(5, 10, 3)).toBe(2);
  });
  it('returns 0 when list is empty', () => {
    expect(adjustIndex(5, 10, 0)).toBe(0);
  });
  it('preserves index if still valid', () => {
    expect(adjustIndex(2, 10, 5)).toBe(2);
  });
});
