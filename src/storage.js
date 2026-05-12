// Storage adapter: GM_* + BroadcastChannel + polling fallback.
// Source of truth is GM storage; BroadcastChannel/GM_addValueChangeListener
// is the wake-up signal.
import { safe } from './safe.js';
import { gm, gmSafe } from './gm.js';
import { log } from './diag.js';

const SCHEMA_VERSION = 1;
const KEY_HIST = `ss.historical.v${SCHEMA_VERSION}`;
const KEY_LOG = `ss.log.v${SCHEMA_VERSION}`;
const KEY_UI = `ss.ui.v${SCHEMA_VERSION}`;
const KEY_CLEAR = `ss.clearedAt.v${SCHEMA_VERSION}`;
const KEY_FIRSTRUN = 'ss.bootedOnce';

const MAX_ENTRIES = 1000;
const MAX_BYTES = 500_000;

let TAB_ID = '';
function makeTabId() {
  if (safe.crypto?.randomUUID) return safe.crypto.randomUUID().slice(0, 8);
  return safe.mathFloor(safe.Math.random() * 0xffffffff).toString(36);
}

let bc = null;
let pollHandles = [];

function envelope(value) {
  return { v: value, src: TAB_ID, ts: safe.dateNow() };
}

function readEnv(key, fallback) {
  return gmSafe(() => {
    const raw = gm.getValue(key, null);
    if (raw == null || raw === '') return { v: fallback, src: null, ts: 0 };
    let parsed;
    try { parsed = (typeof raw === 'string') ? safe.jsonParse(raw) : raw; }
    catch { return { v: fallback, src: null, ts: 0 }; }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'v')) return parsed;
    // Legacy/raw value — treat as the value directly.
    return { v: parsed, src: null, ts: 0 };
  }, { v: fallback, src: null, ts: 0 });
}

export function read(key, fallback) {
  return readEnv(key, fallback).v;
}

function approxByteSize(s) {
  return typeof s === 'string' ? s.length : 0;
}

export function write(key, value) {
  let serialised;
  try {
    serialised = safe.jsonStringify(envelope(value));
  } catch (e) {
    log.error('serialise failed for ' + key + ': ' + e.message);
    return;
  }
  if (approxByteSize(serialised) > MAX_BYTES) {
    log.warn(`value for ${key} too large (${serialised.length} bytes); evicting`);
    if (Array.isArray(value) && value.length > 0) {
      const trimmed = value.slice(Math.floor(value.length * 0.25));
      serialised = safe.jsonStringify(envelope(trimmed));
    }
  }
  gmSafe(() => gm.setValue(key, serialised));
  // Broadcast a wake-up signal.
  try { bc?.postMessage({ key, ts: safe.dateNow(), src: TAB_ID }); } catch {}
}

const listeners = new Map(); // key -> Set<fn>

function fireLocal(key, value) {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) {
    try { fn(value); } catch (e) { log.error('listener for ' + key + ': ' + e.message); }
  }
}

export function listen(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

export function init() {
  // Defensive: tear down any previous instance so test re-init (and any
  // future module-rebind path in production) doesn't accumulate channels.
  teardown();
  TAB_ID = makeTabId();

  // BroadcastChannel for fast intra-browser fan-out.
  if (safe.BroadcastChannel) {
    try {
      bc = new safe.BroadcastChannel('super-search');
      bc.onmessage = (e) => {
        if (!e?.data) return;
        if (e.data.src === TAB_ID) return; // ignore own
        // On any message, re-read the affected key and fire listeners.
        if (listeners.has(e.data.key)) {
          const env = readEnv(e.data.key, undefined);
          fireLocal(e.data.key, env.v);
        }
      };
    } catch (e) { log.warn('BroadcastChannel init failed: ' + e.message); }
  }

  // GM_addValueChangeListener — fires on cross-tab AND cloud-sync changes.
  if (gm.addValueChangeListener) {
    for (const key of [KEY_HIST, KEY_LOG, KEY_CLEAR]) {
      try {
        gm.addValueChangeListener(key, (_k, _old, neu, remote) => {
          if (!remote) return;
          const env = readEnv(key, undefined);
          fireLocal(key, env.v);
        });
      } catch (e) { log.warn('addValueChangeListener failed: ' + e.message); }
    }
  } else if (!bc) {
    // No live signal available — poll every 2s as last-resort fallback.
    log.info('cross-tab sync degraded to polling');
    for (const key of [KEY_HIST, KEY_LOG, KEY_CLEAR]) {
      let last = safe.jsonStringify(read(key, null));
      const h = safe.setInterval(() => {
        const cur = safe.jsonStringify(read(key, null));
        if (cur !== last) { last = cur; fireLocal(key, read(key, null)); }
      }, 2000);
      pollHandles.push(h);
    }
  }
}

export function teardown() {
  try { bc?.close?.(); } catch {}
  for (const h of pollHandles) safe.clearInterval(h);
  pollHandles = [];
}

export function getTabId() { return TAB_ID; }

// ---- Domain helpers ----

export function readAll() {
  return {
    historical: sanitiseArr(read(KEY_HIST, [])),
    logEntries: sanitiseArr(read(KEY_LOG, [])),
    ui: read(KEY_UI, {}),
    clearedAt: Number(read(KEY_CLEAR, 0)) || 0,
    firstRunDone: !!read(KEY_FIRSTRUN, false),
  };
}

function sanitiseArr(v) { return Array.isArray(v) ? v : []; }

export function writeUi(uiState) { write(KEY_UI, uiState); }
export function writeHistorical(arr) { write(KEY_HIST, capArray(arr)); }
export function writeLog(arr) { write(KEY_LOG, capArray(arr)); }
export function writeClearedAt(ts) { write(KEY_CLEAR, Number(ts) || 0); }
export function markFirstRunDone() { write(KEY_FIRSTRUN, true); }
export function clearAll(ts) {
  // Tombstone the cross-tab list: write empty arrays AND broadcast a new
  // clearedAt timestamp so other tabs can drop their in-memory pre-clear
  // entries (otherwise the next mergeHistorical on Tab B reads the empty
  // payload, unions it with B's local non-empty array, and resurrects the
  // matches Tab A just cleared).
  const t = Number(ts) || safe.dateNow();
  write(KEY_CLEAR, t);
  write(KEY_HIST, []);
  write(KEY_LOG, []);
}

function capArray(arr) {
  if (!Array.isArray(arr)) return [];
  if (arr.length <= MAX_ENTRIES) return arr;
  return arr.slice(arr.length - MAX_ENTRIES);
}

// ---- Cross-tab merge with content-id union + tombstone ----

/**
 * Merge `local` and `remote` historical arrays:
 *   - union by Match.id (content-derived → natural dedupe)
 *   - drop entries with capturedAt < clearedAt
 *   - cap at MAX_ENTRIES (FIFO)
 */
export function mergeHistorical(local, remote, clearedAt = 0) {
  const seen = new Set();
  const out = [];
  const all = [...sanitiseArr(local), ...sanitiseArr(remote)];
  all.sort((a, b) => (a.capturedAt || 0) - (b.capturedAt || 0));
  for (const m of all) {
    if (!m || !m.id) continue;
    if ((m.capturedAt || 0) < clearedAt) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  if (out.length > MAX_ENTRIES) return out.slice(out.length - MAX_ENTRIES);
  return out;
}

export { KEY_HIST, KEY_LOG, KEY_UI, KEY_CLEAR, KEY_FIRSTRUN, MAX_ENTRIES, MAX_BYTES };
