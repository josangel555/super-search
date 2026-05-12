// Mounts the panel inside a closed shadow root attached to documentElement.
// Host CSS cannot reach through the shadow boundary; host JS cannot read closed
// shadow roots via element.shadowRoot. Encapsulation is our primary defence.
import { safe } from '../safe.js';
import { el, clear } from '../dom.js';
import { PANEL_STYLES } from './styles.js';

let host = null;
let shadow = null;
let root = null;
const subscribers = new Set();

function randomId() {
  if (safe.crypto?.randomUUID) return 'ss-' + safe.crypto.randomUUID().slice(0, 6);
  return 'ss-' + safe.mathFloor(safe.Math.random() * 0xffffff).toString(16);
}

export function mount() {
  if (host && host.isConnected) return shadow;

  host = document.createElement('div');
  host.id = randomId();
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  // Closed shadow root: even page JS that calls host.shadowRoot gets null.
  shadow = host.attachShadow({ mode: 'closed' });

  // Inject scoped styles via a stylesheet element inside the shadow.
  const style = document.createElement('style');
  style.textContent = PANEL_STYLES;
  shadow.appendChild(style);

  root = el('div', { class: 'ss-panel', dir: 'ltr', hidden: true });
  shadow.appendChild(root);

  // Mount on documentElement, not body — fewer anti-injection scanners look here.
  (document.documentElement || document.body).appendChild(host);

  return shadow;
}

export function isConnected() {
  return host?.isConnected === true;
}

export function reattach() {
  if (!host) return false;
  if (host.isConnected) return false;
  (document.documentElement || document.body).appendChild(host);
  return true;
}

export function show() {
  if (!root) return;
  root.hidden = false;
  const input = root.querySelector('.ss-query');
  if (input) input.focus();
}

export function hide() {
  if (!root) return;
  root.hidden = true;
}

export function toggle() {
  if (!root) return;
  if (root.hidden) show();
  else hide();
}

export function isVisible() {
  return root && !root.hidden;
}

export function rootEl() {
  return root;
}

export function shadowRoot() {
  return shadow;
}

export function hostEl() {
  return host;
}

// Allow other modules to register render hooks that will be called when
// the panel needs to redraw. Each hook gets the shadow root.
export function registerRenderHook(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function render() {
  if (!root) return;
  for (const fn of subscribers) {
    try { fn(root); } catch (e) { /* swallow; logged elsewhere */ }
  }
}
