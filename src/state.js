// Flux-lite store. Single state object, subscribers re-render on every set,
// persistence is debounced.
import { safe } from './safe.js';
import { debounce } from './util/debounce.js';
import { mergeHistorical as mergeHistArr } from './storage.js';

const initial = () => ({
  // UI / control flags (persisted per-tab)
  query: '',
  mode: 'text',          // 'text' | 'selector' | 'js'
  live: true,
  append: false,
  dedupe: false,
  log: { enabled: false, win: true, con: false },
  ui: { visible: false, width: 390, height: 'auto', listCollapsed: false },
  privacy: { incognito: false, denylist: [] },

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
let isNotifying = false;
let pendingNotify = false;

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

// Apply multiple changes as one notify. Used by hot paths (e.g. performSearch)
// to avoid 3-4 cascading re-renders per user action.
export function batch(fn) {
  const before = isNotifying;
  isNotifying = true;
  try { fn(); }
  finally {
    isNotifying = before;
    if (pendingNotify && !isNotifying) {
      pendingNotify = false;
      notify();
    }
  }
}

function notify() {
  if (isNotifying) {
    // Re-entrant set inside a subscriber: defer to avoid mid-iteration mutation
    // of the subscribers set and to avoid a second full pass with the new state.
    pendingNotify = true;
    return;
  }
  isNotifying = true;
  try {
    const snapshot = [...subscribers];
    for (const fn of snapshot) {
      try { fn(state); } catch { /* logged elsewhere */ }
    }
  } finally {
    isNotifying = false;
    if (pendingNotify) {
      pendingNotify = false;
      // One coalesced re-notify with latest state.
      notify();
    }
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

// Merge a remote `historical` payload into local state. Honours tombstones
// (clearedAt) via the merge helper.
export function mergeHistorical(remote) {
  const cur = state.historical || [];
  const merged = mergeHistArr(cur, remote || [], state.clearedAt || 0);
  state = { ...state, historical: merged };
  notify();
}

export function mergeLog(remote) {
  const cur = state.logEntries || [];
  const merged = mergeHistArr(cur, remote || [], state.clearedAt || 0);
  state = { ...state, logEntries: merged };
  notify();
}
