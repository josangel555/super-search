// Tests for observer.__debug_collectPayload — the dirty-roots logic that
// powers incremental rescan.
import { describe, it, expect } from 'bun:test';
import { __debug_collectPayload } from '../../src/observer.js';

function mockRecord(type, target, addedNodes = []) {
  return { type, target, addedNodes, removedNodes: [] };
}

describe('observer.collectPayload', () => {
  it('empty records → fullScan', () => {
    const p = __debug_collectPayload([]);
    expect(p.fullScan).toBe(true);
    expect(p.scanRoots).toEqual([]);
  });

  it('characterData mutation → scanRoot is the text node parent', () => {
    document.body.innerHTML = '<div id="a"><p>x</p></div>';
    const text = document.querySelector('p').firstChild;
    const p = __debug_collectPayload([mockRecord('characterData', text)]);
    expect(p.fullScan).toBe(false);
    expect(p.scanRoots.length).toBe(1);
    expect(p.scanRoots[0].tagName).toBe('P');
  });

  it('childList mutation on body → fullScan', () => {
    document.body.innerHTML = '<p>x</p>';
    const p = __debug_collectPayload([mockRecord('childList', document.body, [])]);
    expect(p.fullScan).toBe(true);
  });

  it('childList mutation on inner div → that div is a scanRoot', () => {
    document.body.innerHTML = '<div id="a"><p>x</p></div><div id="b"></div>';
    const a = document.getElementById('a');
    // addedNodes in a real MutationRecord are already inserted into the DOM
    // (the record fires after insertion). Match that here.
    const newP = document.createElement('p');
    a.appendChild(newP);
    const p = __debug_collectPayload([mockRecord('childList', a, [newP])]);
    expect(p.fullScan).toBe(false);
    // After subsume, a contains newP so only a should be kept (outermost wins).
    expect(p.scanRoots.length).toBe(1);
    expect(p.scanRoots[0]).toBe(a);
  });

  it('subsumes nested roots: parent already in set replaces children', () => {
    document.body.innerHTML = '<div id="outer"><div id="inner"><p>x</p></div></div>';
    const outer = document.getElementById('outer');
    const inner = document.getElementById('inner');
    const p = __debug_collectPayload([
      mockRecord('childList', inner, []),
      mockRecord('childList', outer, []),
    ]);
    expect(p.fullScan).toBe(false);
    expect(p.scanRoots.length).toBe(1);
    expect(p.scanRoots[0]).toBe(outer);
  });

  it('drops disconnected node targets', () => {
    document.body.innerHTML = '<div id="a"></div>';
    const a = document.getElementById('a');
    a.remove();
    const p = __debug_collectPayload([mockRecord('childList', a, [])]);
    // disconnected target is filtered → no scanRoots → fullScan should be false
    // but scanRoots empty. Caller treats both as full-scan via the consumer gate.
    expect(p.scanRoots.length).toBe(0);
  });

  it('drops mutations inside our panel subtree', () => {
    document.body.innerHTML = '<p>x</p>';
    document.documentElement.innerHTML += '<div id="ss-abc"><span id="inner"></span></div>';
    const inner = document.getElementById('inner');
    expect(inner).toBeTruthy();
    const p = __debug_collectPayload([mockRecord('childList', inner, [])]);
    expect(p.scanRoots.length).toBe(0);
  });

  it('caps at MAX_DIRTY_ROOTS → fullScan', () => {
    document.body.innerHTML = '';
    const records = [];
    for (let i = 0; i < 60; i++) {
      const d = document.createElement('div');
      d.id = 'dd' + i;
      document.body.appendChild(d);
      records.push(mockRecord('childList', d, []));
    }
    const p = __debug_collectPayload(records);
    expect(p.fullScan).toBe(true);
  });
});
