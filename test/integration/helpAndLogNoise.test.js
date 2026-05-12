// Tests for Help window, tooltip presence, and the log-noise quieting fix.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';
import * as bus from '../../src/bus.js';
import * as storage from '../../src/storage.js';
import * as panel from '../../src/ui/panel.js';
import { buildUI } from '../../src/wiring.js';
import { resetSessionDedupe } from '../../src/logging.js';

async function fresh(html) {
  resetSessionDedupe();    // session-deduped log entries — reset between tests
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

describe('help window', () => {
  it('Help button renders inside controls and opens the modal on click', async () => {
    const root = await fresh('<p>x</p>');
    const help = root.querySelector('.ss-help-btn');
    expect(help).toBeTruthy();
    expect(help.textContent).toBe('?');

    const modal = root.querySelector('.ss-help-modal');
    expect(modal).toBeTruthy();
    expect(modal.hidden).toBe(true);
    help.click();
    expect(modal.hidden).toBe(false);
  });

  it('Help modal close button hides it', async () => {
    const root = await fresh('<p>x</p>');
    root.querySelector('.ss-help-btn').click();
    const modal = root.querySelector('.ss-help-modal');
    expect(modal.hidden).toBe(false);
    root.querySelector('.ss-help-close').click();
    expect(modal.hidden).toBe(true);
  });

  it('Help body contains keyboard, mode, and option sections', async () => {
    const root = await fresh('<p>x</p>');
    root.querySelector('.ss-help-btn').click();
    const body = root.querySelector('.ss-help-body');
    const heads = [...body.querySelectorAll('h3.ss-help-h')].map(h => h.textContent);
    expect(heads).toContain('Keyboard');
    expect(heads).toContain('Search modes');
    expect(heads).toContain('Options');
    expect(heads).toContain('Buttons');
    expect(heads).toContain('Tips');
    // Should also have at least one example code block.
    expect(body.querySelectorAll('code').length).toBeGreaterThan(5);
  });
});

describe('tooltips on mode buttons and checkboxes', () => {
  it('mode buttons have title attributes explaining each mode', async () => {
    const root = await fresh('<p>x</p>');
    const text = root.querySelector('[data-mode="text"]');
    const css = root.querySelector('[data-mode="selector"]');
    const js = root.querySelector('[data-mode="js"]');
    expect(text.getAttribute('title')).toContain('Text');
    expect(css.getAttribute('title')).toContain('CSS');
    expect(js.getAttribute('title')).toContain('JS');
  });

  it('Append and Log checkbox labels have title attributes that differentiate them', async () => {
    const root = await fresh('<p>x</p>');
    const labels = [...root.querySelectorAll('.ss-controls label')];
    const append = labels.find(l => l.textContent.trim() === 'Append');
    const logLabel = labels.find(l => l.textContent.trim() === 'Log');
    expect(append.getAttribute('title')).toContain('Append');
    expect(logLabel.getAttribute('title')).toContain('audit');
  });
});

describe('mode-specific placeholders', () => {
  it('placeholder changes when switching to CSS mode', async () => {
    const root = await fresh('<p>x</p>');
    const ta = root.querySelector('.ss-query');
    expect(ta.placeholder).toContain('regex');   // text mode default
    state.set({ mode: 'selector' });
    expect(ta.placeholder).toContain('CSS selector');
  });

  it('placeholder changes when switching to JS mode', async () => {
    const root = await fresh('<p>x</p>');
    const ta = root.querySelector('.ss-query');
    state.set({ mode: 'js' });
    expect(ta.placeholder).toContain('JavaScript');
  });
});

describe('log noise quieting', () => {
  it('auto-search with identical results does NOT duplicate log entries', async () => {
    const root = await fresh('<p>alpha alpha</p>');
    state.set({ query: 'alpha', live: true, log: { enabled: true, win: true, con: false } });
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const initialLog = (state.get().logEntries || []).length;

    // Simulate two auto-triggered re-searches (dom-changed bus events).
    bus.emit('dom-changed');
    bus.emit('dom-changed');
    await new Promise(r => setTimeout(r, 50));

    // Identical result fingerprint → no new log entries appended.
    expect((state.get().logEntries || []).length).toBe(initialLog);
  });

  it('auto-search WITH new matches DOES add log entries', async () => {
    const root = await fresh('<p>alpha</p>');
    state.set({ query: 'alpha', live: true, log: { enabled: true, win: true, con: false } });
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const initialLog = (state.get().logEntries || []).length;
    // Mutate the DOM to add more matches.
    document.body.insertAdjacentHTML('beforeend', '<p>alpha alpha</p>');
    bus.emit('dom-changed');
    await new Promise(r => setTimeout(r, 30));
    // The new matches are different content → fingerprint differs → log grows.
    expect((state.get().logEntries || []).length).toBeGreaterThan(initialLog);
  });
});

describe('append + manual observer re-run', () => {
  it('Append on + Live off + dom-changed still re-runs search', async () => {
    const root = await fresh('<p>alpha</p>');
    state.set({ query: 'alpha', live: false, append: true });
    bus.emit('dom-changed');
    await new Promise(r => setTimeout(r, 30));
    expect(state.get().matches.length).toBe(1);
  });

  it('Append off + Live off + dom-changed does NOT re-run', async () => {
    const root = await fresh('<p>alpha</p>');
    state.set({ query: 'alpha', live: false, append: false, matches: [] });
    bus.emit('dom-changed');
    await new Promise(r => setTimeout(r, 30));
    expect(state.get().matches.length).toBe(0);
  });
});

describe('Win/Con UI toggles for log targets', () => {
  it('toggling Win checkbox updates state.log.win', async () => {
    const root = await fresh('<p>x</p>');
    state.set({ log: { enabled: true, win: true, con: false } });
    // The Win checkbox lives in .ss-log-targets and is bound via onToggle('log.win').
    const winCb = [...root.querySelectorAll('input[type="checkbox"]')].find(c => c.getAttribute('title')?.includes('Win'));
    expect(winCb).toBeTruthy();
    winCb.checked = false;
    winCb.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(state.get().log.win).toBe(false);
  });

  it('log targets row hidden when Log disabled', async () => {
    const root = await fresh('<p>x</p>');
    state.set({ log: { enabled: false, win: true, con: false } });
    const targets = root.querySelector('.ss-log-targets');
    expect(targets.hidden).toBe(true);
    state.set({ log: { enabled: true, win: true, con: false } });
    expect(targets.hidden).toBe(false);
  });
});

describe('match list collapse arrow', () => {
  it('aria-expanded toggles on collapse', async () => {
    const root = await fresh('<p>alpha</p>');
    const header = root.querySelector('.ss-list-header');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    state.setDeep({ ui: { listCollapsed: true } });
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('page/list counter', () => {
  it('shows "page / total · list N" when append mode is on with historical entries', async () => {
    const root = await fresh('<p>alpha alpha</p>');
    // Set everything in one batched call so the input subscriber only re-syncs
    // once with the full state — separate state.set calls overwrite matches[]
    // back to [] during the live-mode debounce path.
    // Use kind:'js-string' so the lifecycle pruner subscriber doesn't drop these
    // synthetic matches (it requires a live range OR element OR js-string).
    state.setDeep({
      matches: [{ id: '1', kind: 'js-string' }, { id: '2', kind: 'js-string' }],
      activeIndex: 0,
      append: true,
      historical: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
      query: 'alpha',
    });
    const counter = root.querySelector('.ss-counter');
    expect(counter.textContent).toContain('1 / 2');
    expect(counter.textContent).toContain('list 3');
  });
});
