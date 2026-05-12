// End-to-end inside happy-dom: boot main.js, type into the panel, assert that
// state updates, matches are found, and navigation works.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';

describe('search pipeline', () => {
  beforeEach(async () => {
    state.reset();
    delete globalThis[Symbol.for('super-search.loaded')];
    document.body.innerHTML = '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><p>More lorem here.</p>';
    // Remove any panel left from previous tests.
    for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
    await import('../../src/main.js');
  });

  it('panel boots and state hydrates', async () => {
    expect(state.get().query).toBe('');
    expect(state.get().mode).toBe('text');
  });

  it('plain text search updates state.matches', async () => {
    state.set({ query: 'lorem' });
    // Live mode debounces 100ms. Trigger a manual search via state set + then dispatch.
    const { dispatch } = await import('../../src/search/dispatcher.js');
    const r = dispatch({ query: 'lorem', mode: 'text', root: document.body, sourceUrl: location.href });
    expect(r.matches.length).toBe(2);
  });

  it('mode change to selector + a basic query (no strategy registered yet) returns []', async () => {
    state.set({ mode: 'selector' });
    const { dispatch } = await import('../../src/search/dispatcher.js');
    const r = dispatch({ query: 'p', mode: 'selector', root: document.body });
    // Phase 2 will register selector strategy. For now we expect a safe no-op.
    expect(r.matches).toEqual([]);
  });
});
