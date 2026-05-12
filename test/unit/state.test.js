import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';

describe('state store', () => {
  beforeEach(() => state.reset());

  it('starts with empty initial state', () => {
    expect(state.get().query).toBe('');
    expect(state.get().matches).toEqual([]);
  });

  it('notifies subscribers on set', () => {
    let calls = 0;
    state.subscribe(() => calls++);
    state.set({ query: 'hi' });
    expect(calls).toBe(1);
    expect(state.get().query).toBe('hi');
  });

  it('unsubscribes correctly', () => {
    let calls = 0;
    const unsub = state.subscribe(() => calls++);
    unsub();
    state.set({ query: 'x' });
    expect(calls).toBe(0);
  });

  it('setDeep shallow-merges nested objects', () => {
    state.setDeep({ ui: { width: 500 } });
    expect(state.get().ui.width).toBe(500);
    // Other ui fields preserved.
    expect(state.get().ui.visible).toBe(false);
  });

  it('hydrate merges into initial state', () => {
    state.hydrate({ query: 'restored', mode: 'js' });
    expect(state.get().query).toBe('restored');
    expect(state.get().mode).toBe('js');
  });

  it('schedules persist when persistFn is set', async () => {
    let persisted = null;
    state.setPersistFn((s) => { persisted = s.query; });
    state.set({ query: 'x' });
    await new Promise(r => setTimeout(r, 250));
    expect(persisted).toBe('x');
  });
});
