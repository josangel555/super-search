// Test bootstrap: install happy-dom + GM_* stubs into globalThis.
import { Window } from 'happy-dom';

const win = new Window({ url: 'https://test.example.com/' });

// Mirror essentials onto globalThis so module bodies that read window/document
// at import-time see something.
globalThis.window = win;
globalThis.document = win.document;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;
globalThis.Node = win.Node;
globalThis.Range = win.Range;
globalThis.NodeFilter = win.NodeFilter;
globalThis.MutationObserver = win.MutationObserver;
globalThis.location = win.location;
globalThis.navigator = win.navigator;
globalThis.history = win.history;
globalThis.getSelection = win.getSelection?.bind(win);

// Storage backed by Map; simulates Tampermonkey GM_*.
const store = new Map();
const listeners = new Map(); // key -> Set of listener fns
const menuCmds = new Map();

globalThis.GM_getValue = (k, def) => store.has(k) ? store.get(k) : def;
globalThis.GM_setValue = (k, v) => {
  const old = store.get(k);
  store.set(k, v);
  const set = listeners.get(k);
  if (set) for (const fn of set) {
    try { fn(k, old, v, false); } catch {}
  }
};
globalThis.GM_deleteValue = (k) => { store.delete(k); };
globalThis.GM_addValueChangeListener = (k, fn) => {
  if (!listeners.has(k)) listeners.set(k, new Set());
  listeners.get(k).add(fn);
  return Symbol('listener');
};
globalThis.GM_removeValueChangeListener = (token) => { /* simplified */ };
globalThis.GM_registerMenuCommand = (label, fn) => {
  menuCmds.set(label, fn);
  return menuCmds.size;
};
globalThis.GM_log = (msg) => { /* console.log('[test]', msg); */ };
globalThis.unsafeWindow = win;

// Test helpers (only used from test files).
globalThis.__gmFireRemote = (k, v) => {
  // Simulate a remote (cross-tab/cloud-sync) change event.
  const set = listeners.get(k);
  const ser = typeof v === 'string' ? v : JSON.stringify(v);
  const old = store.get(k);
  store.set(k, ser);
  if (set) for (const fn of set) {
    try { fn(k, old, ser, /*remote*/ true); } catch {}
  }
};
globalThis.__menuFire = (label) => {
  const fn = menuCmds.get(label);
  if (fn) fn();
};
globalThis.__menuList = () => [...menuCmds.keys()];

// Minimal CSS.highlights stub so highlight.js can be imported without throw.
if (typeof globalThis.CSS === 'undefined') globalThis.CSS = {};
if (!globalThis.CSS.highlights) {
  globalThis.CSS.highlights = new Map();
}
if (typeof globalThis.Highlight === 'undefined') {
  globalThis.Highlight = class Highlight {
    constructor(...ranges) { this._ranges = new Set(ranges); }
    add(r) { this._ranges.add(r); return this; }
    delete(r) { return this._ranges.delete(r); }
    clear() { this._ranges.clear(); }
    get size() { return this._ranges.size; }
    [Symbol.iterator]() { return this._ranges[Symbol.iterator](); }
  };
}

// Provide BroadcastChannel stub.
if (typeof globalThis.BroadcastChannel === 'undefined') {
  const channels = new Map();
  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      if (!channels.has(name)) channels.set(name, new Set());
      channels.get(name).add(this);
    }
    postMessage(data) {
      for (const ch of channels.get(this.name) || []) {
        if (ch === this) continue;
        if (ch.onmessage) ch.onmessage({ data });
      }
    }
    close() { channels.get(this.name)?.delete(this); }
    addEventListener(type, fn) { if (type === 'message') this.onmessage = (e) => fn(e); }
    removeEventListener() {}
  };
}

// Reset store between tests — bun test runs each file in a fresh process so
// this is mostly redundant, but we expose a helper for sequential cases.
globalThis.__resetGM = () => {
  store.clear();
  listeners.clear();
  menuCmds.clear();
};

// Define __SS_VERSION__ / __SS_DEV__ that the build inlines but source uses typeof to read.
globalThis.__SS_VERSION__ = 'test';
globalThis.__SS_DEV__ = true;
