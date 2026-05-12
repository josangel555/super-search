// Entry point. Order of imports matters: safe.js first to capture pristine
// references before anything else can run.
import { safe } from './safe.js';
import { checkSentinel } from './sentinel.js';
import { isTopFrame } from './frameguard.js';
import { log, isDiagnostics, setDiagnostics } from './diag.js';
import * as panel from './ui/panel.js';
import * as menu from './ui/menu.js';
import { registerShortcut } from './shortcut.js';

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
  try {
    panel.mount();
  } catch (e) {
    log.error('panel mount failed: ' + (e?.message || e));
    return;
  }

  registerShortcut({}, () => panel.toggle());

  menu.register({
    onToggle: () => panel.toggle(),
    onAbout: () => alert(menu.aboutText()),
    onClearAll: () => {
      // Phase 3 will wire up real storage clearing; placeholder for now.
      log.info('Clear all (placeholder — wired in phase 3)');
    },
    onToggleDiagnostics: () => setDiagnostics(!isDiagnostics()),
  });

  log.info('booted v' + (typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev'));
}

boot();
