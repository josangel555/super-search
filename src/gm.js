// Adapter over Tampermonkey GM_* APIs with feature detection.
// Other modules go through this; never call GM_* directly elsewhere.
import { safe } from './safe.js';

const g = globalThis;

function noop() {}
function noopReturn(d) { return d; }

const has = (name) => typeof g[name] === 'function';

export const gm = safe.objectFreeze({
  getValue: has('GM_getValue') ? g.GM_getValue : noopReturn,
  setValue: has('GM_setValue') ? g.GM_setValue : noop,
  deleteValue: has('GM_deleteValue') ? g.GM_deleteValue : noop,
  addValueChangeListener: has('GM_addValueChangeListener') ? g.GM_addValueChangeListener : null,
  removeValueChangeListener: has('GM_removeValueChangeListener') ? g.GM_removeValueChangeListener : null,
  registerMenuCommand: has('GM_registerMenuCommand') ? g.GM_registerMenuCommand : null,
  log: has('GM_log') ? g.GM_log : (msg) => { try { console.log('[super-search]', msg); } catch {} },
  unsafeWindow: typeof g.unsafeWindow !== 'undefined' ? g.unsafeWindow : g.window,
});

// Helper that catches any GM_* throw.
export function gmSafe(fn, fallback) {
  try { return fn(); } catch (e) { gm.log('gm error: ' + (e?.message || e)); return fallback; }
}
