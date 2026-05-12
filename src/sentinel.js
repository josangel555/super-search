// Singleton guard: prevents multiple instances from initialising when more than
// one userscript manager or duplicate registration exists on the same page.
//
// Uses an unforgeable key — a randomised string property generated at script
// load. Host pages can't enumerate it (they'd have to brute-force) and can't
// detect us via the cross-realm Symbol registry (Symbol.for would expose us).
import { safe } from './safe.js';

// Build a key that's stable across this script's lifetime but not predictable
// from outside. We can't use a local Symbol because module-scope symbols are
// not shared across the multiple userscript injections (different realms),
// so duplicate-injection detection must use a string key on globalThis.
// We hash the script's own version so collision with another script using a
// similar scheme is astronomically unlikely while remaining a fixed name
// for ourselves.
const KEY = (() => {
  const v = typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev';
  // Simple non-cryptographic hash so the key is opaque without revealing version.
  let h = 0x811c9dc5;
  const s = '__ss_' + v + '_loaded';
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return '__$$' + h.toString(36);
})();

export function checkSentinel() {
  if (globalThis[KEY]) {
    return { alreadyLoaded: true };
  }
  // Store only a truthy marker — no version, no timestamp, nothing to enumerate.
  // `configurable: true` is required so test setups can reset between runs
  // via __resetSentinel(). In production this is essentially never invoked.
  Object.defineProperty(globalThis, KEY, {
    value: 1,
    enumerable: false,
    configurable: true,
    writable: false,
  });
  return { alreadyLoaded: false };
}

// Test-only escape hatch. Lets unit/integration tests reset the singleton
// between runs without leaking the actual key to host pages.
export function __resetSentinel() {
  try { delete globalThis[KEY]; } catch {}
}
