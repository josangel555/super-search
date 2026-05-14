// Top-level wiring: builds the UI tree, subscribes it to state, and routes
// input events through dispatcher → state → subscribers. This is intentionally
// kept separate from main.js so main.js stays focused on boot order.
import { safe } from './safe.js';
import * as state from './state.js';
import * as panel from './ui/panel.js';
import * as inputView from './ui/input.js';
import * as controlsView from './ui/controls.js';
import * as listView from './ui/matchList.js';
import { dispatch } from './search/dispatcher.js';
import { syncMatches as setHighlights, install as installHl, installStyles as installHlStyles } from './highlight.js';
import { applyOutlines, restore as restoreOutlines } from './elementHighlight.js';
import { nextIndex, prevIndex, scrollToMatch } from './navigate.js';
import { gm } from './gm.js';
import * as bus from './bus.js';
import * as observer from './observer.js';
import * as storage from './storage.js';
import { pruneDead, adjustIndex, isAlive } from './lifecycle.js';
import * as logView from './ui/logView.js';
import * as helpView from './ui/helpView.js';
import { logMatches } from './logging.js';
import { isAllowedToPersist } from './privacy.js';
import { debounce } from './util/debounce.js';
import { log } from './diag.js';

// Track all subscriptions made by buildUI so we can tear them down if the
// panel is ever rebuilt — prevents duplicate handlers firing N times.
let teardown = null;

export function buildUI(shadow, root) {
  if (teardown) teardown();
  const unsubs = [];

  const controls = controlsView.build();
  const inputBuilt = inputView.build(state);
  const list = listView.build();
  const logRegion = logView.build();
  const helpModal = helpView.build();
  root.appendChild(controls);
  root.appendChild(inputBuilt.row);
  root.appendChild(inputBuilt.summary);
  root.appendChild(list);
  root.appendChild(logRegion);
  root.appendChild(helpModal);

  // Install document-level highlight styles (CSS pseudo-selector ::highlight
  // can't be scoped to a shadow root; needs to be in main document).
  installHlStyles();
  installHl();

  // Track the previous result's fingerprint so we can quiet logging on
  // auto-triggered searches that find the same matches. Without this, every
  // observer-driven re-search re-emits the entire match set into the log.
  let lastResultFingerprint = null;
  const fingerprintMatches = (ms) => {
    if (!ms || ms.length === 0) return 'empty';
    // Cheap fingerprint: ids joined. Stable per content via matchIdFor.
    return ms.map(m => m.id || (m.value + '|' + m.before + '|' + m.after)).join(',');
  };

  const performSearch = (auto = false) => {
    const s = state.get();
    const result = dispatch({ query: s.query, mode: s.mode, root: document.body, sourceUrl: location.href });

    // Fingerprint match BEFORE deciding what to do. Used for both log-noise
    // quieting AND highlight-flicker suppression on pages with animations
    // (animation triggers observer, observer re-runs search, identical
    // result set, but clear-and-re-add of CSS.highlights causes a visible
    // 1-frame flicker on the active match).
    const fp = fingerprintMatches(result.matches);
    const sameAsLast = auto && fp === lastResultFingerprint;
    lastResultFingerprint = fp;

    if (sameAsLast) {
      // Result set is logically identical. Three things to preserve:
      //  1. activeIndex (don't bounce user back to match 0)
      //  2. visual highlights (don't repaint -> no flicker)
      //  3. log silence (already handled by sameAsLast gate below)
      // We DO still refresh the matches[] array so its Range objects are
      // current — if the DOM moved underneath us, fresh ranges anchor to
      // the new positions while the visual stays steady this frame; the
      // next user navigation will use the fresh ranges.
      const idx = (s.activeIndex < result.matches.length) ? s.activeIndex : 0;
      state.set({ matches: result.matches, activeIndex: idx });
      // Skip setHighlights + applyOutlines — old highlight ranges still
      // render at the same content. If any have detached, the lifecycle
      // pruner subscriber will catch them on its own pass.
      return;
    }

    const allowedPersist = isAllowedToPersist(s, location.href);
    const patch = {
      matches: result.matches,
      activeIndex: 0,
      inputError: result.error,
      submode: result.submode,
      truncated: !!result.truncated,
      jsErrorMessage: result.jsErrorMessage || null,
    };
    if (result.lastJsResult !== undefined) {
      patch.lastJsResult = result.lastJsResult;
      patch.lastJsResultPresent = true;
    }
    if (s.append && allowedPersist) {
      patch.historical = mergeHistoricalLocal(s.historical, result.matches);
    }

    if (s.log?.enabled && allowedPersist) {
      const entries = logMatches(result.matches);
      if (entries.length) {
        patch.logEntries = [...(s.logEntries || []), ...entries].slice(-1000);
        if (s.log.con && typeof console !== 'undefined') {
          for (const e of entries) console.log('[super-search]', e);
        }
      }
    }
    state.batch(() => state.set(patch));

    setHighlights(result.matches, 0);
    applyOutlines(result.matches, 0);
  };

  const liveSearch = debounce(100, () => performSearch(true));
  const maybeLive = () => {
    const s = state.get();
    // Live-mode auto-search runs for text/selector only; JS mode is always
    // manual to avoid eval'ing half-typed expressions.
    if (s.live && s.mode !== 'js' && s.query) liveSearch();
  };

  const navigateTo = (idx) => {
    const s = state.get();
    if (s.matches.length === 0) return;
    state.set({ activeIndex: idx });
    setHighlights(s.matches, idx);
    applyOutlines(s.matches, idx);
    scrollToMatch(s.matches[idx]);
  };

  // Incremental search: only re-scan the dirty subtrees the observer reported.
  // Survivors (matches not inside any dirty root, still alive) are kept;
  // fresh matches from dirty roots are merged in by content-derived id;
  // CSS.highlights is updated as a delta (no clear-and-rebuild flicker).
  const performIncrementalSearch = (scanRoots) => {
    const s = state.get();
    const old = s.matches || [];
    const inDirty = (m) => {
      const node = (m.range && m.range.startContainer) || m.element;
      if (!node) return false;
      for (const r of scanRoots) { if (r.contains(node)) return true; }
      return false;
    };

    // 1. Survivors: matches outside all dirty roots AND still alive.
    const survivors = old.filter(m => isAlive(m) && !inDirty(m));

    // 2. Scan only the dirty subtrees.
    const fresh = [];
    for (const r of scanRoots) {
      const sub = dispatch({ query: s.query, mode: s.mode, root: r, sourceUrl: location.href });
      if (sub && Array.isArray(sub.matches)) fresh.push(...sub.matches);
    }

    // 3. Concat. ScanRoots are disjoint from survivors' nodes (survivors are
    // OUTSIDE the dirty roots), so there are no positional duplicates. We do
    // NOT dedup by id here — two matches with identical content in different
    // DOM positions are legitimately separate highlight rows. Cross-tab
    // historical dedup happens elsewhere (mergeHistoricalLocal) where it's
    // semantically correct.
    const merged = [...survivors, ...fresh];

    // 4. Preserve the active match by id. If the prev active is still in
    // merged, find its new position; otherwise default to 0.
    const prevActive = old[s.activeIndex];
    let newActiveIndex = 0;
    if (prevActive) {
      const idx = merged.findIndex(m => m.id === prevActive.id);
      if (idx !== -1) newActiveIndex = idx;
    }

    // 5. Append + log: new matches only (no re-logging of survivors).
    const addedToLog = fresh.filter(m => !old.some(o => o.id === m.id));
    const allowedPersist = isAllowedToPersist(s, location.href);
    const patch = {
      matches: merged,
      activeIndex: newActiveIndex,
      inputError: null,
      truncated: false,
    };
    if (s.append && allowedPersist && addedToLog.length) {
      patch.historical = mergeHistoricalLocal(s.historical, addedToLog);
    }
    if (s.log?.enabled && allowedPersist && addedToLog.length) {
      const entries = logMatches(addedToLog);
      if (entries.length) {
        patch.logEntries = [...(s.logEntries || []), ...entries].slice(-1000);
        if (s.log.con && typeof console !== 'undefined') {
          for (const e of entries) console.log('[super-search]', e);
        }
      }
    }
    state.batch(() => state.set(patch));

    // 6. CSS.highlights + element outlines: delta-apply.
    setHighlights(merged, newActiveIndex);
    applyOutlines(merged, newActiveIndex);

    // Refresh the fingerprint so the next auto-trigger can short-circuit
    // correctly if nothing changes further.
    lastResultFingerprint = fingerprintMatches(merged);
  };

  inputView.setListeners({
    onInput(v) {
      const next = { query: v };
      // Empty query: clear stale error / matches / outlines so the UI doesn't
      // remain stuck in a red-border state after the user deletes their input.
      if (!v) {
        next.matches = [];
        next.activeIndex = 0;
        next.inputError = null;
        next.truncated = false;
        setHighlights([], 0);
        restoreOutlines();
      }
      state.set(next);
      maybeLive();
    },
    onSubmit() {
      const s = state.get();
      if (s.matches.length > 0) {
        navigateTo(nextIndex(s.activeIndex, s.matches.length));
      } else {
        performSearch(false);
      }
    },
    onPrev() {
      const s = state.get();
      if (s.matches.length === 0) return;
      navigateTo(prevIndex(s.activeIndex, s.matches.length));
    },
    onNext() {
      const s = state.get();
      if (s.matches.length === 0) return;
      navigateTo(nextIndex(s.activeIndex, s.matches.length));
    },
    onEscape() {
      panel.hide();
      state.setDeep({ ui: { visible: false } });
    },
  });

  controlsView.setListeners({
    onMode(m) {
      state.set({ mode: m });
      maybeLive();
    },
    onToggle(flag, v) {
      if (flag === 'log') {
        state.setDeep({ log: { enabled: v } });
      } else if (flag === 'log.win') {
        state.setDeep({ log: { win: v } });
      } else if (flag === 'log.con') {
        state.setDeep({ log: { con: v } });
      } else {
        state.set({ [flag]: v });
      }
      if (flag === 'live' && v) maybeLive();
    },
    onHelp() { helpView.toggle(); },
    onCopy() {
      const s = state.get();
      const items = s.append ? s.historical : s.matches;
      if (!items || items.length === 0) {
        log.info('Nothing to copy');
        return;
      }
      const lines = items.map(m => `${m.before || ''}${m.value || ''}${m.after || ''}\t${m.sourceUrl || ''}`);
      copyToClipboard(lines.join('\n'));
    },
    onClearAll() {
      const t = safe.dateNow();
      state.set({
        matches: [],
        activeIndex: 0,
        historical: [],
        logEntries: [],
        clearedAt: t,
        lastJsResult: undefined,
        lastJsResultPresent: false,
        inputError: null,
        truncated: false,
      });
      // Tombstone synchronously so other tabs drop their stale local entries.
      try { storage.clearAll(t); } catch {}
      try { state.flushPersist?.(); } catch {}
      setHighlights([], 0);
      restoreOutlines();
    },
    onDump() {
      const s = state.get();
      if (!s.lastJsResultPresent) return;
      const r = s.lastJsResult;
      try {
        const w = gm.unsafeWindow || (typeof window !== 'undefined' ? window : null);
        if (w) w.superSearchResults = r;
        log.info('Dumped to window.superSearchResults');
      } catch (e) { log.error('dump failed: ' + e.message); }
    },
  });

  listView.setListeners({
    onRowClick(m, i, isHistorical) {
      // Compare sanitised forms on both sides — current-search matches carry
      // full sourceUrl (location.href) but historical matches were sanitised
      // at append-time. Without canonicalising both we'd always reject rows
      // on URLs that have a query string or hash.
      const here = sanitisedUrl(location.href);
      const there = sanitisedUrl(m.sourceUrl);
      if (there && there !== here) {
        log.info('Match is on a different page: ' + there);
        return;
      }
      if (!isHistorical) {
        navigateTo(i);
      } else {
        scrollToMatch(m);
      }
    },
    onToggleCollapse() {
      const s = state.get();
      state.setDeep({ ui: { listCollapsed: !s.ui.listCollapsed } });
    },
  });

  // Render subscriber.
  const unsub1 = state.subscribe((s) => {
    inputView.syncFromState(s);
    controlsView.syncFromState(s);
    listView.syncFromState(s);
    logView.syncFromState(s);
  });
  unsubs.push(unsub1);

  // Lifecycle pruning subscriber: drops dead matches when DOM changes.
  // syncMatches is delta-only so dropping dead matches is now flicker-free.
  let lastPrunedRef = null;
  const unsub2 = state.subscribe((s) => {
    if (!s.matches || s.matches.length === 0) return;
    if (s.matches === lastPrunedRef) return;       // skip on no-op renders (activeIndex changes etc.)
    const live = pruneDead(s.matches);
    if (live.length !== s.matches.length) {
      lastPrunedRef = live;
      const newIdx = adjustIndex(s.activeIndex, s.matches.length, live.length);
      state.set({ matches: live, activeIndex: newIdx });
      setHighlights(live, newIdx);          // delta-apply removes dead ranges only
    } else {
      lastPrunedRef = s.matches;
    }
  });
  unsubs.push(unsub2);

  // Initial paint.
  state.set({});

  // Bus events: observer + nav + settling drive re-search.
  // Re-run on dom-changed when EITHER Live mode is on, OR Append is on
  // (the "scan many pages passively" workflow). Selector mode gets full
  // scan (selector may match anywhere); text/regex/timestamp get
  // incremental scan when the observer payload tells us which subtrees
  // actually changed.
  unsubs.push(bus.on('dom-changed', (payload) => {
    const s = state.get();
    if (!s.query) return;
    if (s.mode === 'js') return;                 // never auto-eval JS
    if (!(s.live || s.append)) return;

    const fullScan = !payload || payload.fullScan || !payload.scanRoots || payload.scanRoots.length === 0;
    if (fullScan || s.mode === 'selector') {
      performSearch(true);
    } else {
      performIncrementalSearch(payload.scanRoots);
    }
  }));
  unsubs.push(bus.on('nav', () => {
    // SPA navigation: rebind observer (body may have been replaced), drop
    // matches (stale ranges), re-search if Live.
    observer.rebind();
    setHighlights([], 0);
    restoreOutlines();
    state.set({ matches: [], activeIndex: 0 });
    if (state.get().live && state.get().query && state.get().mode !== 'js') {
      performSearch(true);
    }
  }));
  unsubs.push(bus.on('pagehide', () => {
    // Best-effort flush.
    state.flushPersist?.();
  }));
  unsubs.push(bus.on('dom-unsettled', () => state.set({ domSettled: false })));
  unsubs.push(bus.on('dom-settled', () => {
    state.set({ domSettled: true });
    // Opportunistic re-run if we have a query — page may have grown more matches.
    // Skip JS mode (manual only). Same Append-or-Live gate as dom-changed.
    const s = state.get();
    if (!s.query || s.mode === 'js') return;
    if (s.live || s.append) performSearch(true);
  }));
  unsubs.push(bus.on('observer-auto-paused', () => {
    log.warn('Search auto-paused — page is mutating too rapidly. Will resume after 30s of quiet.');
  }));

  teardown = () => {
    for (const u of unsubs) { try { u(); } catch {} }
    teardown = null;
  };

  return { teardown };
}

function mergeHistoricalLocal(existing, fresh) {
  const seen = new Set((existing || []).map(m => m.id));
  const out = (existing || []).slice();
  for (const m of fresh) {
    if (!seen.has(m.id)) {
      // Strip non-serialisable Range objects for cross-tab/storage compatibility.
      out.push({ ...m, range: null, element: null, sourceUrl: sanitisedUrl(m.sourceUrl || location.href) });
      seen.add(m.id);
    }
  }
  // FIFO cap at 1000.
  if (out.length > 1000) out.splice(0, out.length - 1000);
  return out;
}

// Drop query string and hash to avoid persisting tokens or session ids.
function sanitisedUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch { return String(url); }
}

function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  // Append inside documentElement (not body) so a page listener on
  // `body.addEventListener('copy', ...)` can't intercept us.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.documentElement.appendChild(ta);
    ta.select();
    document.execCommand?.('copy');
    document.documentElement.removeChild(ta);
  } catch { /* swallow */ }
}
