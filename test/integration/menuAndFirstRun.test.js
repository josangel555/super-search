// Menu commands + first-run auto-open UX.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';
import * as panel from '../../src/ui/panel.js';

async function freshBoot() {
  globalThis.__resetGM();
  state.reset();
  const { __resetSentinel } = await import('../../src/sentinel.js');
  __resetSentinel();
  // Clear any panel left from prior tests.
  for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
  document.body.innerHTML = '<p>x</p>';
  // Re-import main.js with a cache-buster so its top-level boot() runs again.
  await import('../../src/main.js?t=' + Math.random());
}

describe('menu commands & first-run', () => {
  it('first boot auto-opens panel and persists ss.bootedOnce', async () => {
    await freshBoot();
    expect(state.get().ui.visible).toBe(true);
    const raw = GM_getValue('ss.bootedOnce');
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(parsed?.v).toBe(true);
  });

  it('subsequent boot with bootedOnce=true does not auto-open', async () => {
    GM_setValue('ss.bootedOnce', JSON.stringify({ v: true, src: 't', ts: 1 }));
    state.reset();
    const { __resetSentinel } = await import('../../src/sentinel.js');
    __resetSentinel();
    for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
    await import('../../src/main.js?t=' + Math.random());
    // The panel was created hidden; no auto-open path.
    expect(state.get().firstRun).toBe(false);
  });

  it('Toggle panel menu command flips ui.visible', async () => {
    await freshBoot();
    const before = state.get().ui.visible;
    globalThis.__menuFire('Super Search: Toggle panel');
    expect(state.get().ui.visible).toBe(!before);
  });

  it('Clear All menu wipes historical + logEntries + sets clearedAt', async () => {
    await freshBoot();
    state.set({ historical: [{ id: 'a', capturedAt: 1 }], logEntries: [{ ts: 'x', value: 'l' }] });
    globalThis.__menuFire('Super Search: Clear all stored matches');
    expect(state.get().historical).toEqual([]);
    expect(state.get().logEntries).toEqual([]);
    expect(state.get().clearedAt).toBeGreaterThan(0);
  });

  it('Toggle incognito menu command flips privacy.incognito', async () => {
    await freshBoot();
    const before = !!state.get().privacy?.incognito;
    globalThis.__menuFire('Super Search: Toggle incognito (no persistence)');
    expect(!!state.get().privacy.incognito).toBe(!before);
  });

  it('all expected menu entries are registered', async () => {
    await freshBoot();
    const cmds = globalThis.__menuList();
    expect(cmds).toContain('Super Search: Toggle panel');
    expect(cmds).toContain('Super Search: About');
    expect(cmds).toContain('Super Search: Clear all stored matches');
    expect(cmds).toContain('Super Search: Toggle diagnostics');
    expect(cmds).toContain('Super Search: Toggle incognito (no persistence)');
  });
});
