// Observer + nav + settling event cascade.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';
import * as bus from '../../src/bus.js';
import * as panel from '../../src/ui/panel.js';
import { buildUI } from '../../src/wiring.js';

async function boot(html) {
  state.reset();
  bus.clear();
  for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
  CSS.highlights.clear();
  document.body.innerHTML = html;
  buildUI(panel.mount(), panel.rootEl());
}

describe('observer cascade', () => {
  it('dom-changed re-runs current search', async () => {
    await boot('<p>alpha</p>');
    state.set({ query: 'beta', live: true });
    bus.emit('dom-changed');
    expect(state.get().matches.length).toBe(0);
    document.body.insertAdjacentHTML('beforeend', '<p>beta beta</p>');
    bus.emit('dom-changed');
    expect(state.get().matches.length).toBe(2);
  });

  it('dom-changed is suppressed when live is false', async () => {
    await boot('<p>alpha</p>');
    state.set({ query: 'alpha', live: false, matches: [] });
    bus.emit('dom-changed');
    // Should not run search.
    expect(state.get().matches.length).toBe(0);
  });

  it('nav clears matches and re-runs if Live + non-JS', async () => {
    await boot('<p>foo</p>');
    state.set({ query: 'foo', live: true, matches: [{ id: 'stale' }], activeIndex: 0 });
    bus.emit('nav');
    expect(state.get().matches.length).toBe(1);
    expect(state.get().matches[0].id).not.toBe('stale');
    expect(state.get().activeIndex).toBe(0);
  });

  it('nav in JS mode does not auto re-eval', async () => {
    await boot('<p>foo</p>');
    state.set({ query: 'return 1', live: true, mode: 'js', matches: [{ id: 'stale' }] });
    bus.emit('nav');
    // Matches cleared but not re-evaluated.
    expect(state.get().matches.length).toBe(0);
  });

  it('dom-settled toggles state.domSettled and re-runs search when settling', async () => {
    await boot('<p>quiet</p>');
    state.set({ query: 'quiet', live: true });
    bus.emit('dom-unsettled');
    expect(state.get().domSettled).toBe(false);
    bus.emit('dom-settled');
    expect(state.get().domSettled).toBe(true);
    expect(state.get().matches.length).toBe(1);
  });

  it('dom-settled does NOT eval JS mode silently', async () => {
    await boot('<p>x</p>');
    state.set({ query: 'document.body.innerHTML', live: true, mode: 'js' });
    bus.emit('dom-settled');
    // Should not run JS eval as a side effect of settling.
    expect(state.get().matches.length).toBe(0);
  });
});
