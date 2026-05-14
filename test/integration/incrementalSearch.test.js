// End-to-end of the incremental search path: bus.emit('dom-changed', {scanRoots})
// should re-scan only the affected subtrees, preserve survivors, and update
// CSS.highlights as a delta (not clear+rebuild).
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';
import * as bus from '../../src/bus.js';
import * as storage from '../../src/storage.js';
import * as panel from '../../src/ui/panel.js';
import { buildUI } from '../../src/wiring.js';
import { currentSize, activeRange } from '../../src/highlight.js';
import { resetSessionDedupe } from '../../src/logging.js';

async function fresh(html) {
  resetSessionDedupe();
  state.reset(); bus.clear();
  globalThis.__resetGM();
  storage.teardown(); storage.init();
  for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
  CSS.highlights.clear();
  document.body.innerHTML = html;
  buildUI(panel.mount(), panel.rootEl());
  return panel.rootEl();
}

describe('incremental search', () => {
  it('payload with scanRoots scans only those subtrees, preserves survivors elsewhere', async () => {
    const root = await fresh('<div id="left"><p>alpha 1</p></div><div id="right"><p>alpha 2</p></div>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().matches.length).toBe(2);
    const initialIds = state.get().matches.map(m => m.id).sort();

    // Mutate the LEFT subtree only.
    document.getElementById('left').insertAdjacentHTML('beforeend', '<p>alpha 3</p>');
    // Simulate observer emitting an incremental payload.
    bus.emit('dom-changed', { fullScan: false, scanRoots: [document.getElementById('left')] });
    await new Promise(r => setTimeout(r, 30));

    expect(state.get().matches.length).toBe(3);
    // The two original ids must still be present (survivors).
    const survivorIds = state.get().matches.map(m => m.id);
    for (const id of initialIds) {
      expect(survivorIds).toContain(id);
    }
  });

  it('preserves activeIndex by id when matches reorder', async () => {
    const root = await fresh('<div id="a"><p>alpha 1</p></div><div id="b"><p>alpha 2</p></div>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    // Navigate to match 2.
    state.set({ activeIndex: 1 });
    const prev = state.get().matches[1];
    const prevId = prev.id;

    // Mutate the OTHER subtree, adding a new match.
    document.getElementById('a').insertAdjacentHTML('beforeend', '<p>alpha 3</p>');
    bus.emit('dom-changed', { fullScan: false, scanRoots: [document.getElementById('a')] });
    await new Promise(r => setTimeout(r, 30));

    // The previously-active match is still in the list, with the same id.
    const newIdx = state.get().matches.findIndex(m => m.id === prevId);
    expect(newIdx).toBeGreaterThanOrEqual(0);
    expect(state.get().activeIndex).toBe(newIdx);
  });

  it('fullScan: true falls back to whole-body scan', async () => {
    const root = await fresh('<p>alpha</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().matches.length).toBe(1);

    document.body.insertAdjacentHTML('beforeend', '<p>alpha alpha</p>');
    bus.emit('dom-changed', { fullScan: true, scanRoots: [] });
    await new Promise(r => setTimeout(r, 30));
    expect(state.get().matches.length).toBe(3);
  });

  it('selector mode always full-scans (selector may match anywhere)', async () => {
    const root = await fresh('<p class="x">a</p><p class="x">b</p>');
    state.set({ mode: 'selector' });
    const ta = root.querySelector('.ss-query');
    ta.value = '.x';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().matches.length).toBe(2);

    // Add another .x in a different subtree.
    document.body.insertAdjacentHTML('beforeend', '<div id="d"><p class="x">c</p></div>');
    // Even though the payload offers a scanRoot, selector mode must fullScan
    // because querySelectorAll would only return what's inside the root.
    bus.emit('dom-changed', { fullScan: false, scanRoots: [document.getElementById('d')] });
    await new Promise(r => setTimeout(r, 30));
    expect(state.get().matches.length).toBe(3);
  });

  it('CSS.highlights survives an incremental update without flicker (size stays consistent through delta)', async () => {
    const root = await fresh('<div id="x"><p>alpha</p></div><div id="y"><p>alpha</p></div>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const before = currentSize();
    expect(before).toBe(2);

    // Mutate left side only.
    document.getElementById('x').insertAdjacentHTML('beforeend', '<p>alpha</p>');
    bus.emit('dom-changed', { fullScan: false, scanRoots: [document.getElementById('x')] });
    await new Promise(r => setTimeout(r, 30));
    const after = currentSize();
    expect(after).toBe(3);
  });

  it('active-range survives the delta — active highlight does not flicker', async () => {
    const root = await fresh('<div id="a"><p>alpha</p></div><div id="b"><p>alpha</p></div>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    // Move active to match 1.
    state.set({ activeIndex: 1 });
    // Re-run highlight to set active. (Direct call rather than navigateTo.)
    const { syncMatches } = await import('../../src/highlight.js');
    syncMatches(state.get().matches, 1);
    const activeBefore = activeRange();
    expect(activeBefore).toBeTruthy();

    // Trigger incremental update in OTHER subtree.
    document.getElementById('a').insertAdjacentHTML('beforeend', '<p>alpha</p>');
    bus.emit('dom-changed', { fullScan: false, scanRoots: [document.getElementById('a')] });
    await new Promise(r => setTimeout(r, 30));
    // Active range should be preserved (same Range object, no clear+rebuild).
    const activeAfter = activeRange();
    expect(activeAfter).toBe(activeBefore);
  });

  it('log only records newly-added matches (not survivors)', async () => {
    const root = await fresh('<div id="a"><p>alpha 1</p></div><div id="b"><p>alpha 2</p></div>');
    state.set({ log: { enabled: true, win: true, con: false } });
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const initialLog = (state.get().logEntries || []).length;
    expect(initialLog).toBe(2);

    // Add ONE new match in the left subtree.
    document.getElementById('a').insertAdjacentHTML('beforeend', '<p>alpha 3</p>');
    bus.emit('dom-changed', { fullScan: false, scanRoots: [document.getElementById('a')] });
    await new Promise(r => setTimeout(r, 30));
    // Should log exactly 1 new entry, not re-log the survivors.
    expect((state.get().logEntries || []).length).toBe(3);
  });
});
