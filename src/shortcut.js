// Keyboard shortcut registration with capture-phase + keydown, to maximise
// chances of running before host-page handlers preventDefault us.
import { safe } from './safe.js';

const DEFAULT = { key: 'F', shift: true, ctrl: true, alt: false, meta: false };

export function registerShortcut(spec, handler) {
  const s = { ...DEFAULT, ...(spec || {}) };
  const target = s.key.toLowerCase();

  function onKeydown(e) {
    if (!e) return;
    if ((e.ctrlKey || false) !== s.ctrl) return;
    if ((e.shiftKey || false) !== s.shift) return;
    if ((e.altKey || false) !== s.alt) return;
    if ((e.metaKey || false) !== s.meta) return;
    const k = (e.key || '').toLowerCase();
    if (k !== target) return;
    try {
      handler(e);
      e.preventDefault();
      e.stopPropagation();
    } catch (err) {
      // Never let our handler tear down the host page.
    }
  }

  // Capture-phase on window — runs before any bubbling-phase listener
  // and before document/body listeners.
  window.addEventListener('keydown', onKeydown, { capture: true });
  return () => window.removeEventListener('keydown', onKeydown, { capture: true });
}
