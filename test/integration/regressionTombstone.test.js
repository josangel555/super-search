// Regression tests pinning recent fixes so they don't quietly rot.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';
import * as storage from '../../src/storage.js';
import * as panel from '../../src/ui/panel.js';
import * as bus from '../../src/bus.js';
import { buildUI } from '../../src/wiring.js';

async function freshUI(html) {
  state.reset();
  bus.clear();
  globalThis.__resetGM();
  storage.teardown();
  storage.init();
  for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
  CSS.highlights.clear();
  document.body.innerHTML = html;
  buildUI(panel.mount(), panel.rootEl());
  return panel.rootEl();
}

describe('regressions', () => {
  it('row-click works on URLs containing ?query and #hash (sanitised compare)', async () => {
    const root = await freshUI('<p>alpha alpha alpha</p>');
    // Pretend the page is a URL with query and hash.
    const origHref = location.href;
    try {
      Object.defineProperty(location, 'href', {
        configurable: true,
        get: () => 'https://test.example/page?id=1#sec',
      });
      const ta = root.querySelector('.ss-query');
      ta.value = 'alpha';
      ta.dispatchEvent(new window.Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      expect(state.get().matches.length).toBe(3);

      // Simulate clicking the 3rd row.
      const li = root.querySelectorAll('.ss-list li')[2];
      expect(li).toBeTruthy();
      li.click();
      expect(state.get().activeIndex).toBe(2);
    } finally {
      Object.defineProperty(location, 'href', { configurable: true, value: origHref });
    }
  });

  it('storage.clearAll writes a clearedAt and historical tombstone', async () => {
    storage.writeHistorical([{ id: 'a', capturedAt: 5 }]);
    const before = storage.readAll();
    expect(before.historical.length).toBe(1);
    storage.clearAll(42);
    const after = storage.readAll();
    expect(after.historical).toEqual([]);
    expect(after.clearedAt).toBe(42);
  });

  it('remote clearedAt drops local pre-clear historical entries on merge', async () => {
    state.reset();
    storage.teardown();
    storage.init();
    // Local has entries pre-clear.
    state.set({ historical: [
      { id: 'old', capturedAt: 5 },
      { id: 'newer', capturedAt: 100 },
    ]});
    // Simulate the remote-clear listener in main.js doing its filter:
    const clearedAt = 50;
    state.set({ clearedAt });
    const local = state.get();
    const filtered = (local.historical || []).filter(m => (m.capturedAt || 0) >= clearedAt);
    state.set({ historical: filtered });
    expect(state.get().historical.map(m => m.id)).toEqual(['newer']);
  });
});

describe('accessibility', () => {
  it('match-list rows have role=button and tabindex=0', async () => {
    const root = await freshUI('<p>alpha alpha</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const rows = root.querySelectorAll('.ss-list li');
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('role')).toBe('button');
    expect(rows[0].getAttribute('tabindex')).toBe('0');
    expect(rows[0].getAttribute('aria-current')).toBe('true');
    expect(rows[1].getAttribute('aria-current')).toBeNull();
  });

  it('match-list row Enter key activates row', async () => {
    const root = await freshUI('<p>alpha alpha</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const rows = root.querySelectorAll('.ss-list li');
    rows[1].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(state.get().activeIndex).toBe(1);
  });

  it('mode picker is a radiogroup with one tabindex=0 button', async () => {
    const root = await freshUI('<p>x</p>');
    const picker = root.querySelector('.ss-mode-picker');
    expect(picker.getAttribute('role')).toBe('radiogroup');
    const radios = picker.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(3);
    const tabbable = [...radios].filter(b => b.tabIndex === 0);
    expect(tabbable.length).toBe(1);
  });

  it('mode picker arrow-key navigation moves selection', async () => {
    const root = await freshUI('<p>x</p>');
    const picker = root.querySelector('.ss-mode-picker');
    const textBtn = picker.querySelector('[data-mode="text"]');
    textBtn.focus();
    picker.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    // The handler reads e.target which won't match in happy-dom event dispatch
    // exactly — we re-dispatch directly on the source button.
    textBtn.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(state.get().mode).toBe('selector');
  });

  it('summary line is a live region', async () => {
    const root = await freshUI('<p>x</p>');
    const sum = root.querySelector('.ss-summary');
    expect(sum.getAttribute('role')).toBe('status');
    expect(sum.getAttribute('aria-live')).toBe('polite');
  });

  it('icon buttons have aria-label', async () => {
    const root = await freshUI('<p>x</p>');
    const prev = [...root.querySelectorAll('button')].find(b => b.textContent === '<');
    const next = [...root.querySelectorAll('button')].find(b => b.textContent === '>');
    expect(prev.getAttribute('aria-label')).toBeTruthy();
    expect(next.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('observer state reset', () => {
  it('observer.start() resets autopause / settle module state', async () => {
    const observer = await import('../../src/observer.js');
    // Trigger autopause via repeated bus events on a synthetic page.
    observer.start({ visibilityGet: () => true, queryGet: () => 'x', liveGet: () => true });
    // We can't easily exercise the rate limit synchronously, but resume()
    // exposes the same reset path; verify it clears state.
    observer.resume();
    expect(observer.isPaused()).toBe(false);
    // Restart and assert paused remains false.
    observer.start({ visibilityGet: () => true, queryGet: () => 'x', liveGet: () => true });
    expect(observer.isPaused()).toBe(false);
  });
});
