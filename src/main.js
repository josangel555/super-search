// Entry point. Order of imports matters: safe.js first to capture pristine
// references before anything else can run.
import { safe } from './safe.js';
import { checkSentinel } from './sentinel.js';
import { isTopFrame } from './frameguard.js';
import { log, isDiagnostics, setDiagnostics } from './diag.js';
import * as panel from './ui/panel.js';
import * as menu from './ui/menu.js';
import { registerShortcut } from './shortcut.js';
import * as state from './state.js';
import * as storage from './storage.js';
import * as observer from './observer.js';
import * as nav from './nav.js';
import { buildUI } from './wiring.js';

function boot() {
  // 1. Sentinel — bail if another instance has loaded.
  const s = checkSentinel();
  if (s.alreadyLoaded) {
    log.warn('already loaded; bailing.');
    return;
  }

  // 2. Frame guard — defence-in-depth for @noframes.
  if (!isTopFrame()) {
    log.info('not top frame; bailing.');
    return;
  }

  // 3. Wait for body if necessary (rare with @run-at document-idle).
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', boot2, { once: true });
    return;
  }
  boot2();
}

function boot2() {
  // Initialise storage + cross-tab plumbing first so initial state hydration
  // and remote-change subscriptions are in place before the UI starts.
  try {
    storage.init();
    const initial = storage.readAll();
    state.hydrate({
      historical: initial.historical || [],
      logEntries: initial.logEntries || [],
      ui: { ...state.get().ui, ...(initial.ui || {}) },
      clearedAt: initial.clearedAt || 0,
      firstRun: !initial.firstRunDone,
    });
    // Persist whitelist: only the cross-tab synced state, plus UI. Runtime
    // fields (matches, lastJsResult) are intentionally excluded — they
    // contain non-serialisable Range/Element references and would bloat
    // every write.
    state.setPersistFn((s) => {
      storage.writeHistorical(s.historical || []);
      storage.writeLog(s.logEntries || []);
      storage.writeUi(s.ui || {});
      // clearedAt is updated only via storage.clearAll() — no need to write here.
    });
    storage.listen(storage.KEY_HIST, (v) => state.mergeHistorical(v || []));
    storage.listen(storage.KEY_LOG, (v) => state.mergeLog(v || []));
    storage.listen(storage.KEY_CLEAR, (v) => {
      const ts = Number(v) || 0;
      if (ts <= (state.get().clearedAt || 0)) return;
      // Apply the remote tombstone: drop our local pre-clear entries.
      state.set({ clearedAt: ts });
      const local = state.get();
      const filtered = (local.historical || []).filter(m => (m.capturedAt || 0) >= ts);
      const filteredLog = (local.logEntries || []).filter(e => new Date(e.ts).getTime() >= ts);
      state.set({ historical: filtered, logEntries: filteredLog });
    });
  } catch (e) {
    log.error('storage init failed: ' + (e?.message || e));
    // Continue — script remains functional without persistence.
  }

  let shadow;
  try {
    shadow = panel.mount();
  } catch (e) {
    log.error('panel mount failed: ' + (e?.message || e));
    return;
  }

  const rootEl = panel.rootEl();
  try {
    buildUI(shadow, rootEl);
  } catch (e) {
    log.error('UI wiring failed: ' + (e?.message || e));
    return;
  }

  registerShortcut({}, () => {
    panel.toggle();
    state.setDeep({ ui: { visible: panel.isVisible() } });
  });

  menu.register({
    onToggle: () => {
      panel.toggle();
      state.setDeep({ ui: { visible: panel.isVisible() } });
    },
    onAbout: () => alert(menu.aboutText()),
    onClearAll: () => {
      const t = safe.dateNow();
      state.set({
        matches: [], historical: [], logEntries: [],
        clearedAt: t, activeIndex: 0,
        lastJsResult: undefined, lastJsResultPresent: false,
        inputError: null, truncated: false,
      });
      // Write the tombstone IMMEDIATELY (storage.clearAll) before any
      // in-flight observer-driven append can re-publish the old historical
      // via the debounced state-persistence path.
      try { storage.clearAll(t); } catch {}
      try { state.flushPersist?.(); } catch {}
    },
    onToggleDiagnostics: () => {
      setDiagnostics(!isDiagnostics());
      log.info('diagnostics ' + (isDiagnostics() ? 'on' : 'off'));
    },
    onToggleIncognito: () => {
      state.setDeep({ privacy: { incognito: !state.get().privacy?.incognito } });
      log.info('incognito ' + (state.get().privacy?.incognito ? 'on' : 'off'));
    },
  });

  // Phase 4: observer + nav hooks.
  try {
    observer.start({
      visibilityGet: () => panel.isVisible(),
      queryGet: () => state.get().query,
      liveGet: () => state.get().live,
    });
    nav.start();
  } catch (e) { log.warn('observer/nav start failed: ' + e.message); }

  // First-run UX: auto-open the panel so the user knows the script is loaded.
  // Mark done BEFORE show — protects against tab-close mid-show double-opening.
  if (state.get().firstRun) {
    try { storage.markFirstRunDone(); } catch {}
    panel.show();
    state.setDeep({ ui: { visible: true } });
    state.set({ firstRun: false });
  } else if (state.get().ui?.visible) {
    // Restore previous-session visibility — panel mounts hidden by default,
    // and without this the persisted ui.visible flag is silently discarded.
    panel.show();
  }

  // Install a test-only escape hatch so the E2E suite can pierce the closed
  // shadow root. Gated by __SS_DEV__ (build-time define) so production
  // bundles never expose it.
  if (typeof __SS_DEV__ !== 'undefined' && __SS_DEV__) {
    const w = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    const findInput = () => {
      // The panel root is held by the panel module; query it from there.
      const r = panel.rootEl();
      return r ? r.querySelector('.ss-query') : null;
    };
    w.__SS_TEST__ = {
      state, panel, observer, nav, storage,
      // Drive the full pipeline through real DOM events so the production
      // input handler, debounce, dispatcher, state.set, subscribers and
      // setHighlights all run identically to a user interaction.
      async fireInput(value) {
        const ta = findInput();
        if (!ta) throw new Error('panel input not available');
        ta.value = String(value);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        // Allow Live-mode debounce (100ms) + a margin for the render pass.
        await new Promise(r => setTimeout(r, 180));
      },
      async fireKey(key, opts = {}) {
        const ta = findInput();
        if (!ta) throw new Error('panel input not available');
        ta.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
        await new Promise(r => setTimeout(r, 30));
      },
      setMode(m) { state.set({ mode: m }); },
      toggle() { panel.toggle(); state.setDeep({ ui: { visible: panel.isVisible() } }); },
    };
    // Wire the bus + sentinel references for tests that want them.
    import('./bus.js').then(b => { w.__SS_TEST__.bus = b; });
    import('./sentinel.js').then(s => { w.__SS_TEST__.sentinel = s; });
  }

  log.info('booted v' + (typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev'));
}

boot();
