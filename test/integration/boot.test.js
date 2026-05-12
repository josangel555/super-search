import { describe, it, expect } from 'bun:test';

describe('boot smoke', () => {
  it('main.js mounts a panel inside a shadow root on documentElement', async () => {
    const { __resetSentinel } = await import('../../src/sentinel.js');
    __resetSentinel();
    await import('../../src/main.js');

    // The panel mounts a div with an id starting with 'ss-' on documentElement.
    const host = document.documentElement.querySelector('div[id^="ss-"]');
    expect(host).not.toBeNull();
    // host.shadowRoot is null because we used { mode: 'closed' } — that's
    // the encapsulation we want. We can verify the host has been styled.
    expect(host.style.position).toBe('fixed');
  });

  it('toggle panel visibility', async () => {
    const panel = await import('../../src/ui/panel.js');
    if (!panel.isConnected()) panel.mount();
    panel.show();
    expect(panel.isVisible()).toBe(true);
    panel.hide();
    expect(panel.isVisible()).toBe(false);
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
  });
});
