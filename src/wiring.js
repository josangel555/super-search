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
import { setMatches as setHighlights, install as installHl, installStyles as installHlStyles } from './highlight.js';
import { applyOutlines, restore as restoreOutlines } from './elementHighlight.js';
import { nextIndex, prevIndex, scrollToMatch } from './navigate.js';
import { gm } from './gm.js';
import * as bus from './bus.js';
import { pruneDead, adjustIndex } from './lifecycle.js';
import * as logView from './ui/logView.js';
import { logMatches } from './logging.js';
import { isAllowedToPersist } from './privacy.js';
import { debounce } from './util/debounce.js';
import { el } from './dom.js';
import { log } from './diag.js';

export function buildUI(shadow, root) {
  const controls = controlsView.build();
  const inputBuilt = inputView.build(state);
  const list = listView.build();
  const logRegion = logView.build();
  root.appendChild(controls);
  root.appendChild(inputBuilt.row);
  root.appendChild(inputBuilt.summary);
  root.appendChild(list);
  root.appendChild(logRegion);

  // Install document-level highlight styles (CSS pseudo-selector ::highlight
  // can't be scoped to a shadow root; needs to be in main document).
  installHlStyles();
  installHl();

  const performSearch = (auto = false) => {
    const s = state.get();
    const result = dispatch({ query: s.query, mode: s.mode, root: document.body, sourceUrl: location.href });
    state.set({
      matches: result.matches,
      activeIndex: 0,
      inputError: result.error,
      submode: result.submode,
      truncated: !!result.truncated,
      lastJsResult: result.lastJsResult !== undefined ? result.lastJsResult : state.get().lastJsResult,
    });
    setHighlights(result.matches, 0);
    applyOutlines(result.matches, 0);

    // Append + logging are persistence-affecting ops; honour privacy gate.
    const allowedPersist = isAllowedToPersist(state.get(), location.href);
    if (state.get().append && allowedPersist) {
      const next = mergeHistorical(state.get().historical, result.matches);
      state.set({ historical: next });
    }
    if (state.get().log?.enabled && allowedPersist) {
      const entries = logMatches(result.matches);
      if (entries.length) {
        const merged = [...(state.get().logEntries || []), ...entries];
        if (state.get().log.con && typeof console !== 'undefined') {
          for (const e of entries) console.log('[super-search]', e);
        }
        state.set({ logEntries: merged.slice(-1000) });
      }
    }
  };

  const liveSearch = debounce(100, () => performSearch(true));

  inputView.setListeners({
    onInput(v) {
      state.set({ query: v });
      if (state.get().live) liveSearch();
    },
    onSubmit() {
      const s = state.get();
      if (s.matches.length > 0) {
        // Enter cycles to next.
        const ni = nextIndex(s.activeIndex, s.matches.length);
        state.set({ activeIndex: ni });
        setHighlights(s.matches, ni);
        applyOutlines(s.matches, ni);
        scrollToMatch(s.matches[ni]);
      } else {
        performSearch(false);
      }
    },
    onPrev() {
      const s = state.get();
      if (s.matches.length === 0) return;
      const pi = prevIndex(s.activeIndex, s.matches.length);
      state.set({ activeIndex: pi });
      setHighlights(s.matches, pi);
      applyOutlines(s.matches, pi);
      scrollToMatch(s.matches[pi]);
    },
    onNext() {
      const s = state.get();
      if (s.matches.length === 0) return;
      const ni = nextIndex(s.activeIndex, s.matches.length);
      state.set({ activeIndex: ni });
      setHighlights(s.matches, ni);
      scrollToMatch(s.matches[ni]);
    },
  });

  controlsView.setListeners({
    onMode(m) {
      state.set({ mode: m });
      if (state.get().query && state.get().live) liveSearch();
    },
    onToggle(flag, v) {
      if (flag === 'log') {
        state.set({ log: { ...state.get().log, enabled: v } });
      } else {
        state.set({ [flag]: v });
      }
      if (state.get().query && state.get().live && (flag === 'live' && v)) liveSearch();
    },
    onCopy() {
      const s = state.get();
      const items = s.append ? s.historical : s.matches;
      const lines = items.map(m => `${m.before}${m.value}${m.after}\t${m.sourceUrl}`);
      const txt = lines.join('\n');
      copyToClipboard(txt);
    },
    onClearAll() {
      state.set({
        matches: [], activeIndex: 0, historical: [],
        logEntries: [], clearedAt: safe.dateNow(),
      });
      setHighlights([], 0);
      restoreOutlines();
    },
    onDump() {
      const r = state.get().lastJsResult;
      if (r === undefined) return;
      try {
        if (gm.unsafeWindow) gm.unsafeWindow.superSearchResults = r;
        else if (typeof window !== 'undefined') window.superSearchResults = r;
        log.info('Dumped to window.superSearchResults');
      } catch (e) { log.error('dump failed: ' + e.message); }
    },
  });

  listView.setListeners({
    onRowClick(m, i, isHistorical) {
      // For current-page rows, scroll. For cross-page, just inform.
      if (m.sourceUrl && m.sourceUrl !== location.href) {
        log.info('Match is on a different page: ' + m.sourceUrl);
        return;
      }
      if (!isHistorical) {
        state.set({ activeIndex: i });
        setHighlights(state.get().matches, i);
      }
      scrollToMatch(m);
    },
    onToggleCollapse() {
      const s = state.get();
      state.set({ ui: { ...s.ui, listCollapsed: !s.ui.listCollapsed } });
    },
  });

  // Subscribe each view to state changes.
  state.subscribe((s) => {
    inputView.syncFromState(s);
    controlsView.syncFromState(s);
    listView.syncFromState(s);
    logView.syncFromState(s);
  });

  // Initial paint.
  state.set({});

  // Bus events: observer + nav + settling drive re-search.
  bus.on('dom-changed', () => {
    if (!state.get().live) return;
    performSearch(true);
  });
  bus.on('nav', () => {
    // SPA navigation: drop current matches (likely stale), re-search if Live.
    setHighlights([], 0);
    restoreOutlines();
    state.set({ matches: [], activeIndex: 0 });
    if (state.get().live && state.get().query) performSearch(true);
  });
  bus.on('pagehide', () => {
    // Best-effort flush.
    state.flushPersist?.();
  });
  bus.on('dom-unsettled', () => state.set({ domSettled: false }));
  bus.on('dom-settled', () => {
    state.set({ domSettled: true });
    // Opportunistic re-run if we have a query — page may have grown more matches.
    if (state.get().live && state.get().query) performSearch(true);
  });

  // Lifecycle pruning subscriber: drops dead matches before render.
  state.subscribe((s) => {
    if (!s.matches || s.matches.length === 0) return;
    const live = pruneDead(s.matches);
    if (live.length !== s.matches.length) {
      const newIdx = adjustIndex(s.activeIndex, s.matches.length, live.length);
      state.set({ matches: live, activeIndex: newIdx });
      setHighlights(live, newIdx);
    }
  });
}

function mergeHistorical(existing, fresh) {
  const seen = new Set(existing.map(m => m.id));
  const out = existing.slice();
  for (const m of fresh) {
    if (!seen.has(m.id)) {
      // Strip non-serialisable Range objects for storage compatibility — but
      // keep elements as live refs for in-tab clicks. Phase 3 will refine this.
      out.push({ ...m, range: null, element: null });
      seen.add(m.id);
    }
  }
  // FIFO cap at 1000.
  if (out.length > 1000) out.splice(0, out.length - 1000);
  return out;
}

function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand?.('copy');
    document.body.removeChild(ta);
  } catch { /* swallow */ }
}
