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
      firstRun: !initial.firstRunDone,
    });
    state.setPersistFn((s) => {
      storage.writeHistorical(s.historical || []);
      storage.writeLog(s.logEntries || []);
      storage.writeUi(s.ui || {});
    });
    storage.listen(storage.KEY_HIST, (v) => state.mergeHistorical(v || []));
    storage.listen(storage.KEY_LOG, (v) => state.mergeLog(v || []));
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
      state.set({ matches: [], historical: [], logEntries: [], clearedAt: safe.dateNow(), activeIndex: 0 });
      try { storage.clearAll(); } catch {}
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
  if (state.get().firstRun) {
    panel.show();
    state.setDeep({ ui: { visible: true } });
    try { storage.markFirstRunDone(); } catch {}
  }

  log.info('booted v' + (typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev'));
}

boot();
