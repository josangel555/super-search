// Tampermonkey menu entries — the always-available fallback UI.
// Even when the host page steals our keyboard shortcut, the user can reach
// us through the Tampermonkey extension menu.
import { gm } from '../gm.js';

const registered = [];

export function register({ onToggle, onAbout, onClearAll, onToggleDiagnostics }) {
  if (!gm.registerMenuCommand) return;

  try {
    registered.push(gm.registerMenuCommand('Super Search: Toggle panel', onToggle));
    registered.push(gm.registerMenuCommand('Super Search: About', onAbout));
    registered.push(gm.registerMenuCommand('Super Search: Clear all stored matches', onClearAll));
    registered.push(gm.registerMenuCommand('Super Search: Toggle diagnostics', onToggleDiagnostics));
  } catch (e) {
    gm.log('menu registration failed: ' + (e?.message || e));
  }
}

export function aboutText() {
  const v = typeof __SS_VERSION__ !== 'undefined' ? __SS_VERSION__ : 'dev';
  return `Super Search v${v}\n\nPress Ctrl+Shift+F to toggle the panel.\nIf the shortcut is blocked by this site, use this menu.`;
}
