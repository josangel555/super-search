// Flux-lite store. Single state object, subscribers re-render on every set,
// persistence is debounced.
import { safe } from './safe.js';
import { debounce } from './util/debounce.js';

const initial = () => ({
  // UI / control flags (persisted per-tab)
  query: '',
  mode: 'text',          // 'text' | 'selector' | 'js'
  live: true,
  append: false,
  dedupe: false,
  log: { enabled: false, win: true, con: false },
  ui: { visible: false, width: 390, height: 'auto', listCollapsed: false },

  // Cross-tab synced
  historical: [],
  logEntries: [],
  clearedAt: 0,

  // Runtime — not persisted
  matches: [],
  activeIndex: 0,
  inputError: null,      // 'regex' | 'selector' | 'js' | 'redos' | null
  truncated: false,
  submode: 'empty',      // 'plain' | 'regex' | 'timestamp' | 'selector' | 'js' | 'empty'
  lastJsResult: undefined,
  domSettled: true,
  firstRun: false,
});

let state = initial();
const subscribers = new Set();
let persistFn = null;        // Set externally by storage layer

export function get() { return state; }

export function set(patch) {
  state = { ...state, ...patch };
  notify();
  if (persistFn) schedulePersist();
}

export function setDeep(patch) {
  // Shallow-merge per top-level key.
  const next = { ...state };
  for (const k in patch) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof next[k] === 'object') {
      next[k] = { ...next[k], ...v };
    } else {
      next[k] = v;
    }
  }
  state = next;
  notify();
  if (persistFn) schedulePersist();
}

function notify() {
  for (const fn of subscribers) {
    try { fn(state); } catch { /* logged elsewhere */ }
  }
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

const schedulePersist = debounce(200, () => { if (persistFn) persistFn(state); });

export function setPersistFn(fn) { persistFn = fn; }

export function hydrate(partial) {
  if (!partial) return;
  state = { ...state, ...partial };
  notify();
}

export function reset() {
  state = initial();
  notify();
}

// Force a synchronous persist (used on Clear All etc.).
export function flushPersist() {
  if (persistFn) {
    schedulePersist.cancel?.();
    persistFn(state);
  }
}
