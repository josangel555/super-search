// SPA navigation detection: popstate, hashchange, and monkey-patched
// pushState/replaceState. Emits 'nav' on bus when the visible page changes
// without a hard reload.
import * as bus from './bus.js';
import { log } from './diag.js';

let started = false;
let origPush = null;
let origReplace = null;

export function start() {
  if (started) return;
  started = true;

  // History API instrumentation.
  try {
    origPush = history.pushState.bind(history);
    origReplace = history.replaceState.bind(history);
    history.pushState = function (...args) {
      const r = origPush(...args);
      bus.emit('nav', { kind: 'push' });
      return r;
    };
    history.replaceState = function (...args) {
      const r = origReplace(...args);
      bus.emit('nav', { kind: 'replace' });
      return r;
    };
  } catch (e) { log.warn('history patch failed: ' + e.message); }

  window.addEventListener('popstate', () => bus.emit('nav', { kind: 'pop' }));
  window.addEventListener('hashchange', () => bus.emit('nav', { kind: 'hash' }));
  window.addEventListener('pagehide', () => bus.emit('pagehide'));
}

export function stop() {
  if (!started) return;
  if (origPush) history.pushState = origPush;
  if (origReplace) history.replaceState = origReplace;
  started = false;
}
