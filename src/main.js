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
    },
    onToggleDiagnostics: () => setDiagnostics(!isDiagnostics()),
  });

  log.info('booted v' + (typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev'));
}

boot();
