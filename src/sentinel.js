// Singleton guard: prevents multiple instances from initialising when more than
// one userscript manager or duplicate registration exists on the same page.
import { safe } from './safe.js';

const KEY = Symbol.for('super-search.loaded');

export function checkSentinel() {
  if (globalThis[KEY]) {
    return { alreadyLoaded: true, info: globalThis[KEY] };
  }
  globalThis[KEY] = {
    version: typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev',
    bootedAt: safe.dateNow(),
  };
  return { alreadyLoaded: false };
}
