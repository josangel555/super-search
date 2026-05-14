// MutationObserver with debounce, visibility gate, auto-pause, settling.
// Emits 'dom-changed' on bus when host page mutates. Tracks DOM-settling
// state and emits 'dom-settled' when activity quiets.
import { safe } from './safe.js';
import { debounce } from './util/debounce.js';
import * as bus from './bus.js';
import { log } from './diag.js';

const DEBOUNCE_MS = 500;
const SETTLE_WINDOW_MS = 500;
const SETTLE_THRESHOLD = 5;       // mutations per window
const AUTOPAUSE_RATE_LIMIT = 5;   // searches per...
const AUTOPAUSE_WINDOW_MS = 10_000;
const AUTOPAUSE_COOLDOWN_MS = 30_000;  // auto-clear pause after this much quiet
const MAX_DIRTY_ROOTS = 50;       // beyond this, just fall back to full scan

let observer = null;
let settleTimer = null;
let mutationsThisWindow = 0;
let isSettled = false;            // start unsettled so the first quiet window emits dom-settled
let visibilityGet = () => true;
let queryGet = () => '';
let liveGet = () => true;
let recentTriggers = [];
let autoPaused = false;
let lastPauseAt = 0;

// Mutations accumulate between debounce fires so the payload reflects every
// change in the window — not just the most-recent burst.
let pendingRecords = [];

const fireMutate = debounce(DEBOUNCE_MS, () => {
  // Drain accumulated records.
  const records = pendingRecords;
  pendingRecords = [];

  // Auto-cooldown: if paused but the page has been quiet for AUTOPAUSE_COOLDOWN_MS, unpause.
  if (autoPaused && (safe.dateNow() - lastPauseAt) > AUTOPAUSE_COOLDOWN_MS) {
    autoPaused = false;
    recentTriggers = [];
    bus.emit('observer-resumed');
    log.info('observer auto-resumed after cooldown');
  }
  if (autoPaused) return;
  if (!visibilityGet()) return;
  if (!queryGet()) return;
  if (!liveGet()) return;
  recentTriggers.push(safe.dateNow());
  const cutoff = safe.dateNow() - AUTOPAUSE_WINDOW_MS;
  recentTriggers = recentTriggers.filter(t => t >= cutoff);
  if (recentTriggers.length > AUTOPAUSE_RATE_LIMIT) {
    autoPaused = true;
    lastPauseAt = safe.dateNow();
    log.warn('observer auto-paused (too many DOM changes; will auto-resume after quiet)');
    bus.emit('observer-auto-paused');
    return;
  }

  // Build the scanRoots set from accumulated MutationRecords. Subscribers
  // can use this to do an incremental search instead of a full body re-scan.
  // `fullScan: true` is emitted when too many roots, body/html-level changes,
  // or no useful records were captured.
  const payload = collectPayload(records);
  bus.emit('dom-changed', payload);
});

function collectPayload(records) {
  if (!records || records.length === 0) return { fullScan: true, scanRoots: [] };
  const raw = new Set();
  let fullScan = false;
  for (const r of records) {
    const t = r.target;
    if (!t) continue;
    // Mutations on body or html — too broad; fall back to full scan.
    if (t === document.body || t === document.documentElement) { fullScan = true; break; }
    if (r.type === 'characterData') {
      if (t.parentElement) raw.add(t.parentElement);
    } else if (r.type === 'childList') {
      raw.add(t);
      // Added nodes themselves are subtrees worth scanning.
      for (const n of r.addedNodes) {
        if (n && n.nodeType === 1) raw.add(n);
      }
    }
  }
  if (fullScan || raw.size === 0) return { fullScan: true, scanRoots: [] };
  if (raw.size > MAX_DIRTY_ROOTS) return { fullScan: true, scanRoots: [] };

  // Filter: drop disconnected nodes, drop our own panel subtree.
  const filtered = [];
  for (const el of raw) {
    if (!el.isConnected) continue;
    // Our panel host element has an id starting with 'ss-'. closest() climbs.
    try { if (el.closest && el.closest('div[id^="ss-"]')) continue; } catch {}
    filtered.push(el);
  }
  if (filtered.length === 0) return { fullScan: false, scanRoots: [] };

  // Subsume: if A is an ancestor of B, drop B (A's scan covers it).
  // Sort by depth desc so outer ancestors come last, then iterate keeping
  // outermost only.
  const minimal = [];
  for (const el of filtered) {
    let subsumedBy = -1;
    for (let i = 0; i < minimal.length; i++) {
      if (minimal[i].contains(el)) { subsumedBy = i; break; }
      if (el.contains(minimal[i])) { minimal[i] = el; subsumedBy = i; break; }
    }
    if (subsumedBy === -1) minimal.push(el);
  }
  return { fullScan: false, scanRoots: minimal };
}

export function start(opts = {}) {
  // Defensive: stop any prior instance before starting a new one so repeated
  // start() calls don't leak observers or settle intervals.
  stop();
  // Reset module state so a second start() doesn't inherit autopause / settle
  // flags from a previous session.
  autoPaused = false;
  lastPauseAt = 0;
  recentTriggers = [];
  isSettled = false;
  mutationsThisWindow = 0;

  visibilityGet = opts.visibilityGet || (() => true);
  queryGet = opts.queryGet || (() => '');
  liveGet = opts.liveGet || (() => true);

  if (!safe.MutationObserver) {
    log.warn('MutationObserver unavailable');
    return;
  }

  const Mo = safe.MutationObserver;
  observer = new Mo((records) => {
    // Capture the records so the debounced consumer has full context, not
    // just the most-recent burst.
    if (records && records.length) {
      for (const r of records) pendingRecords.push(r);
    }
    mutationsThisWindow++;
    if (isSettled) {
      isSettled = false;
      bus.emit('dom-unsettled');
    }
    fireMutate();
  });
  rebind();

  // Settling tracker.
  settleTimer = safe.setInterval(() => {
    if (mutationsThisWindow < SETTLE_THRESHOLD) {
      if (!isSettled) {
        isSettled = true;
        bus.emit('dom-settled');
      }
    } else {
      isSettled = false;
    }
    mutationsThisWindow = 0;
  }, SETTLE_WINDOW_MS);
}

export function rebind() {
  if (!observer) return;
  try {
    observer.disconnect();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (e) {
    log.warn('observer rebind: ' + e.message);
  }
}

export function stop() {
  try { observer?.disconnect(); } catch {}
  try { safe.clearInterval(settleTimer); } catch {}
  observer = null;
  settleTimer = null;
}

export function resume() {
  autoPaused = false;
  recentTriggers = [];
  lastPauseAt = 0;
  bus.emit('observer-resumed');
  log.info('observer resumed');
}

export function isPaused() { return autoPaused; }
export function isDomSettled() { return isSettled; }

// Exposed for tests: convert a MutationRecord array to the payload that
// fireMutate would emit, without going through the debounce.
export function __debug_collectPayload(records) { return collectPayload(records); }
