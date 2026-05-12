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

const fireMutate = debounce(DEBOUNCE_MS, () => {
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
  bus.emit('dom-changed');
});

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
  observer = new Mo(() => {
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
