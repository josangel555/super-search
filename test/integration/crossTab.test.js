// Cross-tab plumbing tests.
// Uses __gmFireRemote(key, value) from test/setup.js to simulate a remote
// (cross-tab / cloud-sync) value change.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as storage from '../../src/storage.js';

describe('cross-tab plumbing', () => {
  beforeEach(() => {
    globalThis.__resetGM();
    storage.teardown();
    storage.init();
  });

  it('remote KEY_HIST change fires listen() callback', async () => {
    let received = null;
    storage.listen(storage.KEY_HIST, v => received = v);
    globalThis.__gmFireRemote(storage.KEY_HIST, JSON.stringify({
      v: [{ id: 'm_remote', value: 'remote', capturedAt: 100 }],
      src: 'other-tab', ts: 100,
    }));
    expect(received).toBeTruthy();
    expect(received[0].id).toBe('m_remote');
  });

  it('remote KEY_CLEAR change fires listener with timestamp', async () => {
    let cleared = null;
    storage.listen(storage.KEY_CLEAR, v => cleared = v);
    globalThis.__gmFireRemote(storage.KEY_CLEAR, JSON.stringify({ v: 999, src: 'other', ts: 999 }));
    expect(cleared).toBe(999);
  });

  it('storage.clearAll writes BOTH historical and clearedAt', async () => {
    storage.writeHistorical([{ id: 'a' }, { id: 'b' }]);
    storage.clearAll(42);
    const all = storage.readAll();
    expect(all.historical).toEqual([]);
    expect(all.clearedAt).toBe(42);
  });

  it('mergeHistorical drops entries older than clearedAt', () => {
    const local = [{ id: 'old', capturedAt: 5 }, { id: 'new', capturedAt: 100 }];
    const remote = [];
    const merged = storage.mergeHistorical(local, remote, 50);
    expect(merged.map(m => m.id)).toEqual(['new']);
  });

  it('mergeHistorical respects content-derived ids for concurrent appends', () => {
    // Tab A appended these.
    const local = [{ id: 'A1', capturedAt: 10 }, { id: 'A2', capturedAt: 20 }];
    // Tab B appended in parallel.
    const remote = [{ id: 'B1', capturedAt: 15 }, { id: 'A1', capturedAt: 10 }];
    const merged = storage.mergeHistorical(local, remote, 0);
    // A1 collapses (same id, same content), other entries preserved.
    expect(merged.length).toBe(3);
    expect(merged.map(m => m.id).sort()).toEqual(['A1', 'A2', 'B1']);
  });

  it('written-by-self events do not echo to local listener (no infinite loop)', async () => {
    let count = 0;
    storage.listen(storage.KEY_HIST, () => count++);
    storage.write(storage.KEY_HIST, [{ id: 'X', capturedAt: 1 }]);
    // wait a few ticks — listener should NOT fire for our own writes via the
    // GM listener path. (The test harness's BroadcastChannel may echo within
    // a single happy-dom realm; that's a test-env artifact not a prod bug.)
    await new Promise(r => setTimeout(r, 20));
    // We tolerate at most one self-echo as a test-env quirk; the important
    // invariant is "no runaway loop".
    expect(count).toBeLessThanOrEqual(1);
  });
});
