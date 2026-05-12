// ==UserScript==
// @name         Super Search
// @namespace    https://github.com/jos/RegExSearch
// @version      0.1.0
// @description  Ultra-compact page search (text, regex, timestamp, selectors, JS query) with live/manual search, persistent match list, cycling, and logging.
// @author       Jos
// @match        *://*/*
// @icon         https://www.svgrepo.com/show/508005/search-alt-2.svg
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  };

  // src/safe.js
  var g = globalThis, _Array = g.Array, _Object = g.Object, _RegExp = g.RegExp, _JSON = g.JSON, _Promise = g.Promise, _Map = g.Map, _Set = g.Set, _Date = g.Date, _Math = g.Math, _String = g.String, _Number = g.Number, _WeakRef = typeof g.WeakRef < "u" ? g.WeakRef : null, _Error = g.Error, _setTimeout = g.setTimeout?.bind(g) ?? null, _clearTimeout = g.clearTimeout?.bind(g) ?? null, _setInterval = g.setInterval?.bind(g) ?? null, _clearInterval = g.clearInterval?.bind(g) ?? null, _queueMicrotask = g.queueMicrotask?.bind(g) ?? null, _requestAnimationFrame = g.requestAnimationFrame?.bind(g) ?? null, _requestIdleCallback = g.requestIdleCallback?.bind(g) ?? null, _MutationObserver = g.MutationObserver ?? null, _BroadcastChannel = typeof g.BroadcastChannel < "u" ? g.BroadcastChannel : null, _Highlight = typeof g.Highlight < "u" ? g.Highlight : null, _cssHighlights = typeof g.CSS < "u" && g.CSS.highlights ? g.CSS.highlights : null, _crypto = g.crypto ?? null, _NodeFilter = g.NodeFilter ?? null, _Range = g.Range ?? null, arrayFrom = _Array.from.bind(_Array), arrayIsArray = _Array.isArray.bind(_Array), objectAssign = _Object.assign.bind(_Object), objectKeys = _Object.keys.bind(_Object), objectEntries = _Object.entries.bind(_Object), objectFreeze = _Object.freeze.bind(_Object), jsonParse = _JSON.parse.bind(_JSON), jsonStringify = _JSON.stringify.bind(_JSON), dateNow = _Date.now.bind(_Date), mathMin = _Math.min.bind(_Math), mathMax = _Math.max.bind(_Math), mathFloor = _Math.floor.bind(_Math), safe = objectFreeze({
    Array: _Array,
    Object: _Object,
    RegExp: _RegExp,
    JSON: _JSON,
    Promise: _Promise,
    Map: _Map,
    Set: _Set,
    Date: _Date,
    Math: _Math,
    String: _String,
    Number: _Number,
    WeakRef: _WeakRef,
    Error: _Error,
    setTimeout: _setTimeout,
    clearTimeout: _clearTimeout,
    setInterval: _setInterval,
    clearInterval: _clearInterval,
    queueMicrotask: _queueMicrotask,
    requestAnimationFrame: _requestAnimationFrame,
    requestIdleCallback: _requestIdleCallback,
    MutationObserver: _MutationObserver,
    BroadcastChannel: _BroadcastChannel,
    Highlight: _Highlight,
    cssHighlights: _cssHighlights,
    crypto: _crypto,
    NodeFilter: _NodeFilter,
    Range: _Range,
    arrayFrom,
    arrayIsArray,
    objectAssign,
    objectKeys,
    objectEntries,
    objectFreeze,
    jsonParse,
    jsonStringify,
    dateNow,
    mathMin,
    mathMax,
    mathFloor
  });

  // src/sentinel.js
  var KEY = (() => {
    let v = "0.1.0", h = 2166136261, s = "__ss_" + v + "_loaded";
    for (let i = 0; i < s.length; i++)
      h ^= s.charCodeAt(i), h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    return "__$$" + h.toString(36);
  })();
  function checkSentinel() {
    return globalThis[KEY] ? { alreadyLoaded: !0 } : (Object.defineProperty(globalThis, KEY, {
      value: 1,
      enumerable: !1,
      configurable: !0,
      writable: !1
    }), { alreadyLoaded: !1 });
  }

  // src/frameguard.js
  function isTopFrame() {
    try {
      return window.top === window;
    } catch {
      return !1;
    }
  }

  // src/gm.js
  var g2 = globalThis;
  function noop() {
  }
  function noopReturn(d) {
    return d;
  }
  var has = (name) => typeof g2[name] == "function", gm = safe.objectFreeze({
    getValue: has("GM_getValue") ? g2.GM_getValue : noopReturn,
    setValue: has("GM_setValue") ? g2.GM_setValue : noop,
    deleteValue: has("GM_deleteValue") ? g2.GM_deleteValue : noop,
    addValueChangeListener: has("GM_addValueChangeListener") ? g2.GM_addValueChangeListener : null,
    removeValueChangeListener: has("GM_removeValueChangeListener") ? g2.GM_removeValueChangeListener : null,
    registerMenuCommand: has("GM_registerMenuCommand") ? g2.GM_registerMenuCommand : null,
    log: has("GM_log") ? g2.GM_log : (msg) => {
      try {
        console.log("[super-search]", msg);
      } catch {
      }
    },
    unsafeWindow: typeof g2.unsafeWindow < "u" ? g2.unsafeWindow : g2.window
  });
  function gmSafe(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      return gm.log("gm error: " + (e?.message || e)), fallback;
    }
  }

  // src/diag.js
  var MAX = 200, entries = [], diagnosticsMode = !1;
  function add(level, msg) {
    let e = { level, msg: String(msg), ts: safe.dateNow() };
    entries.push(e), entries.length > MAX && entries.shift(), (diagnosticsMode || level === "error") && gm.log(`[${level}] ${e.msg}`);
  }
  var log = {
    info: (m) => add("info", m),
    warn: (m) => add("warn", m),
    error: (m) => add("error", m)
  };
  function getEntries() {
    return entries.slice();
  }
  function setDiagnostics(on2) {
    diagnosticsMode = !!on2;
  }
  function isDiagnostics() {
    return diagnosticsMode;
  }

  // src/dom.js
  function el(tag, props = {}, ...children) {
    let node = document.createElement(tag);
    for (let k in props) {
      let v = props[k];
      if (!(v == null || v === !1))
        if (k === "class" || k === "className") node.className = v;
        else if (k === "style" && typeof v == "object")
          for (let sk in v) node.style[sk] = v[sk];
        else if (k.startsWith("on") && typeof v == "function")
          node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "dataset" && typeof v == "object")
          for (let dk in v) node.dataset[dk] = v[dk];
        else k in node ? node[k] = v : node.setAttribute(k, v);
    }
    for (let c of children)
      if (!(c == null || c === !1))
        if (typeof c == "string" || typeof c == "number")
          node.appendChild(document.createTextNode(String(c)));
        else if (Array.isArray(c))
          for (let cc of c)
            cc == null || cc === !1 || node.appendChild(typeof cc == "string" || typeof cc == "number" ? document.createTextNode(String(cc)) : cc);
        else
          node.appendChild(c);
    return node;
  }
  function clear(node) {
    for (; node.firstChild; ) node.removeChild(node.firstChild);
  }

  // src/ui/styles.js
  var PANEL_STYLES = `
:host, :root { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }

.ss-panel {
  all: initial;
  position: fixed;
  top: 20px;
  right: 10px;
  width: 390px;
  min-width: 330px;
  max-width: 85vw;
  min-height: 180px;
  max-height: 75vh;
  background: #eef1f5;
  border: 1px solid #b0c4de;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  line-height: 1.3;
  color: #333;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
  direction: ltr;
  text-align: left;
}

.ss-panel[hidden] { display: none; }

.ss-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 6px;
  flex-wrap: wrap;
}

.ss-mode-picker { display: flex; gap: 2px; }

.ss-mode-picker button {
  background: #fff;
  border: 1px solid #b0c4de;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
}
.ss-mode-picker button[aria-pressed="true"] {
  background: #0078d4;
  color: #fff;
  border-color: #005a9c;
}

.ss-controls {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
}

.ss-controls label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
}

.ss-controls input[type="checkbox"] {
  margin: 0;
}

.ss-controls button {
  background: #0078d4;
  color: #fff;
  border: 1px solid #005a9c;
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
}
.ss-controls button:hover { background: #005a9c; }
.ss-controls button[disabled] { opacity: 0.5; cursor: default; }

.ss-input-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  align-items: flex-start;
}

.ss-query {
  flex-grow: 1;
  padding: 6px 8px;
  border: 1px solid #b0c4de;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  background: #fff;
  color: #222;
  resize: vertical;
  min-height: 30px;
  max-height: 200px;
}
.ss-query.ss-mode-js {
  min-height: 60px;
  height: 80px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 12px;
}
.ss-query.ss-error {
  border-color: #d83b01;
  box-shadow: 0 0 3px #d83b01;
}

.ss-input-actions { display: flex; flex-direction: column; gap: 2px; }
.ss-input-actions button {
  background: #0078d4;
  color: #fff;
  border: 1px solid #005a9c;
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.ss-input-actions button:hover { background: #005a9c; }
.ss-input-actions button[hidden] { display: none; }

.ss-summary {
  font-size: 11px;
  color: #555;
  margin-bottom: 4px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.ss-summary .ss-settling-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffa500;
  animation: ss-pulse 1.2s infinite;
}
@keyframes ss-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.ss-list-region {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ss-list-header {
  font-size: 11px;
  font-weight: bold;
  padding: 2px 0;
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: space-between;
}

.ss-list {
  flex-grow: 1;
  overflow-y: auto;
  list-style: none;
  background: #fff;
  border: 1px solid #d1dbe6;
  border-radius: 3px;
  padding: 2px;
  font-size: 11px;
  min-height: 60px;
}

.ss-list li {
  padding: 3px 4px;
  border-bottom: 1px solid #eef1f5;
  cursor: pointer;
  display: flex;
  gap: 4px;
}
.ss-list li:hover { background: #f0f6fc; }
.ss-list li.ss-active { background: #fff4ce; }

.ss-list .ss-row-num { color: #888; flex-shrink: 0; min-width: 24px; }
.ss-list .ss-row-text { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-list .ss-row-match { background: #ffe066; padding: 0 2px; border-radius: 2px; }
.ss-list .ss-row-url {
  background: #d1e4f5;
  color: #003366;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 8px;
  flex-shrink: 0;
}

.ss-log-region {
  margin-top: 6px;
  border-top: 1px solid #c5d9ed;
  padding-top: 4px;
  max-height: 100px;
  overflow-y: auto;
  font-size: 10px;
  font-family: 'Menlo', 'Monaco', monospace;
  color: #555;
  display: none;
}
.ss-log-region.ss-visible { display: block; }

.ss-log li { padding: 1px 0; list-style: none; }
.ss-log li.ss-log-error { color: #d83b01; }
.ss-log-ts { color: #888; }
.ss-log-kind { color: #2a3a55; font-weight: bold; }
.ss-log-ctx { color: #555; }
.ss-log-match { background: #ffe066; padding: 0 2px; border-radius: 2px; }
.ss-log-url { color: #607d8b; font-style: italic; }
.ss-log-targets { display: inline-flex; gap: 4px; }

.ss-first-run-banner {
  background: #fff4ce;
  border: 1px solid #d4b400;
  border-radius: 3px;
  padding: 6px 8px;
  margin-bottom: 6px;
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  gap: 6px;
}
.ss-first-run-banner button {
  background: #d4b400;
  color: #fff;
  border: 0;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.ss-help-modal {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 25, 45, 0.55);
  z-index: 10;
  display: flex;
  align-items: stretch;
  padding: 8px;
  overflow: hidden;
}
.ss-help-modal[hidden] { display: none; }
.ss-help-modal::before {
  content: '';
  position: absolute; inset: 0;
  /* clickable overlay; modal body absorbs clicks via stopPropagation in body */
}
.ss-help-modal > .ss-help-header,
.ss-help-modal > .ss-help-body { position: relative; }

.ss-help-modal { flex-direction: column; gap: 0; padding: 0; background: rgba(15, 25, 45, 0.45); }
.ss-help-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; background: #2a3a55; color: #fff;
  border-radius: 6px 6px 0 0;
}
.ss-help-title { font-weight: 600; font-size: 13px; }
.ss-help-close {
  background: transparent; border: none; color: #fff; font-size: 20px;
  cursor: pointer; line-height: 1; padding: 0 4px;
}
.ss-help-close:hover { color: #ffd700; }
.ss-help-body {
  flex-grow: 1; overflow-y: auto;
  background: #fff; color: #222;
  padding: 8px 12px; font-size: 12px; line-height: 1.4;
  border-radius: 0 0 6px 6px;
}
.ss-help-body h3.ss-help-h {
  margin: 8px 0 4px;
  font-size: 12px; font-weight: 700; color: #2a3a55;
  text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 1px solid #d1dbe6; padding-bottom: 2px;
}
.ss-help-body h3.ss-help-h:first-child { margin-top: 0; }
.ss-help-table { border-collapse: collapse; margin: 4px 0 6px; width: 100%; }
.ss-help-table td { padding: 2px 4px; vertical-align: top; }
.ss-help-key {
  font-family: 'Menlo', 'Monaco', monospace; font-size: 11px;
  background: #eef1f5; padding: 1px 4px; border-radius: 3px;
  white-space: nowrap; width: 1%;
}
.ss-help-val { color: #333; }

.ss-help-item { margin: 4px 0 8px; }
.ss-help-item-title { font-weight: 700; color: #2a3a55; font-size: 12px; }
.ss-help-item-body { white-space: pre-line; color: #444; margin: 2px 0; }
.ss-help-examples { list-style: none; margin: 2px 0 0 0; padding: 0; }
.ss-help-examples li { margin: 1px 0; padding: 1px 0; }
.ss-help-examples code {
  font-family: 'Menlo', 'Monaco', monospace; font-size: 11px;
  background: #f5f7fa; padding: 1px 4px; border-radius: 3px;
  border: 1px solid #d1dbe6; color: #2a3a55;
}
.ss-help-note { color: #666; font-size: 11px; }

.ss-help-btn {
  background: transparent !important; color: #2a3a55 !important;
  border: 1px solid #b0c4de !important; padding: 2px 7px !important;
  border-radius: 50% !important; cursor: pointer;
  font-size: 12px !important; line-height: 1 !important;
  width: 22px; height: 22px;
}
.ss-help-btn:hover { background: #d1dbe6 !important; }

/* Collapse-arrow flip when the list is collapsed. */
.ss-list-region.ss-collapsed .ss-collapse { display: inline-block; transform: rotate(-90deg); }
.ss-collapse { display: inline-block; transition: transform 0.15s ease; }

@media (forced-colors: active) {
  .ss-panel { border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
  .ss-list .ss-row-match { background: Highlight; color: HighlightText; }
  .ss-help-body { background: Canvas; color: CanvasText; }
  .ss-help-header { background: Canvas; color: CanvasText; border-bottom: 1px solid CanvasText; }
}
`;

  // src/ui/panel.js
  var host = null, shadow = null, root = null;
  function randomId() {
    return safe.crypto?.randomUUID ? "ss-" + safe.crypto.randomUUID().slice(0, 6) : "ss-" + safe.mathFloor(safe.Math.random() * 16777215).toString(16);
  }
  function mount() {
    if (host && host.isConnected) return shadow;
    host = document.createElement("div"), host.id = randomId(), host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;", shadow = host.attachShadow({ mode: "closed" });
    let style = document.createElement("style");
    return style.textContent = PANEL_STYLES, shadow.appendChild(style), root = el("div", { class: "ss-panel", dir: "ltr", hidden: !0 }), shadow.appendChild(root), (document.documentElement || document.body).appendChild(host), shadow;
  }
  function show() {
    if (!root) return;
    root.hidden = !1, clampToViewport();
    let input = root.querySelector(".ss-query");
    input && input.focus();
  }
  function clampToViewport() {
    if (!(!root || typeof window > "u"))
      try {
        let maxW = Math.floor(window.innerWidth * 0.85), maxH = Math.floor(window.innerHeight * 0.75), curW = parseInt(root.style.width || "", 10);
        curW && curW > maxW && (root.style.width = maxW + "px");
        let curH = parseInt(root.style.height || "", 10);
        curH && curH > maxH && (root.style.height = maxH + "px");
      } catch {
      }
  }
  function hide() {
    root && (root.hidden = !0);
  }
  function toggle() {
    root && (root.hidden ? show() : hide());
  }
  function isVisible() {
    return root && !root.hidden;
  }
  function rootEl() {
    return root;
  }

  // src/ui/menu.js
  var registered = [];
  function register(handlers2) {
    if (!gm.registerMenuCommand) return;
    let { onToggle, onAbout, onClearAll, onToggleDiagnostics, onToggleIncognito } = handlers2;
    try {
      onToggle && registered.push(gm.registerMenuCommand("Super Search: Toggle panel", onToggle)), onAbout && registered.push(gm.registerMenuCommand("Super Search: About", onAbout)), onClearAll && registered.push(gm.registerMenuCommand("Super Search: Clear all stored matches", onClearAll)), onToggleDiagnostics && registered.push(gm.registerMenuCommand("Super Search: Toggle diagnostics", onToggleDiagnostics)), onToggleIncognito && registered.push(gm.registerMenuCommand("Super Search: Toggle incognito (no persistence)", onToggleIncognito));
    } catch (e) {
      gm.log("menu registration failed: " + (e?.message || e));
    }
  }
  function aboutText() {
    return `Super Search v0.1.0

Press Ctrl+Shift+F to toggle the panel.
If the shortcut is blocked by this site, use this menu.`;
  }

  // src/shortcut.js
  var DEFAULT = { key: "F", shift: !0, ctrl: !0, alt: !1, meta: !1 };
  function registerShortcut(spec, handler) {
    let s = { ...DEFAULT, ...spec || {} }, target = s.key.toLowerCase();
    function onKeydown(e) {
      if (!(!e || (e.ctrlKey || !1) !== s.ctrl || (e.shiftKey || !1) !== s.shift || (e.altKey || !1) !== s.alt || (e.metaKey || !1) !== s.meta || (e.key || "").toLowerCase() !== target))
        try {
          handler(e), e.preventDefault(), e.stopPropagation();
        } catch {
        }
    }
    return window.addEventListener("keydown", onKeydown, { capture: !0 }), () => window.removeEventListener("keydown", onKeydown, { capture: !0 });
  }

  // src/state.js
  var state_exports = {};
  __export(state_exports, {
    batch: () => batch,
    flushPersist: () => flushPersist,
    get: () => get,
    hydrate: () => hydrate,
    mergeHistorical: () => mergeHistorical2,
    mergeLog: () => mergeLog,
    reset: () => reset,
    set: () => set,
    setDeep: () => setDeep,
    setPersistFn: () => setPersistFn,
    subscribe: () => subscribe
  });

  // src/util/debounce.js
  function debounce(ms, fn) {
    let t = null, wrapped = (...args) => {
      t !== null && safe.clearTimeout(t), t = safe.setTimeout(() => {
        t = null, fn(...args);
      }, ms);
    };
    return wrapped.cancel = () => {
      t !== null && (safe.clearTimeout(t), t = null);
    }, wrapped.flush = (...args) => {
      wrapped.cancel(), fn(...args);
    }, wrapped;
  }

  // src/storage.js
  var SCHEMA_VERSION = 1, KEY_HIST = `ss.historical.v${SCHEMA_VERSION}`, KEY_LOG = `ss.log.v${SCHEMA_VERSION}`, KEY_UI = `ss.ui.v${SCHEMA_VERSION}`, KEY_CLEAR = `ss.clearedAt.v${SCHEMA_VERSION}`, KEY_FIRSTRUN = "ss.bootedOnce", MAX_ENTRIES = 1e3, MAX_BYTES = 5e5, TAB_ID = "";
  function makeTabId() {
    return safe.crypto?.randomUUID ? safe.crypto.randomUUID().slice(0, 8) : safe.mathFloor(safe.Math.random() * 4294967295).toString(36);
  }
  var bc = null, pollHandles = [];
  function envelope(value) {
    return { v: value, src: TAB_ID, ts: safe.dateNow() };
  }
  function readEnv(key2, fallback) {
    return gmSafe(() => {
      let raw = gm.getValue(key2, null);
      if (raw == null || raw === "") return { v: fallback, src: null, ts: 0 };
      let parsed;
      try {
        parsed = typeof raw == "string" ? safe.jsonParse(raw) : raw;
      } catch {
        return { v: fallback, src: null, ts: 0 };
      }
      return parsed && typeof parsed == "object" && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, "v") ? parsed : { v: parsed, src: null, ts: 0 };
    }, { v: fallback, src: null, ts: 0 });
  }
  function read(key2, fallback) {
    return readEnv(key2, fallback).v;
  }
  function approxByteSize(s) {
    return typeof s == "string" ? s.length : 0;
  }
  function write(key2, value) {
    let serialised;
    try {
      serialised = safe.jsonStringify(envelope(value));
    } catch (e) {
      log.error("serialise failed for " + key2 + ": " + e.message);
      return;
    }
    if (approxByteSize(serialised) > MAX_BYTES && (log.warn(`value for ${key2} too large (${serialised.length} bytes); evicting`), Array.isArray(value) && value.length > 0)) {
      let trimmed = value.slice(Math.floor(value.length * 0.25));
      serialised = safe.jsonStringify(envelope(trimmed));
    }
    gmSafe(() => gm.setValue(key2, serialised));
    try {
      bc?.postMessage({ key: key2, ts: safe.dateNow(), src: TAB_ID });
    } catch {
    }
  }
  var listeners = /* @__PURE__ */ new Map();
  function fireLocal(key2, value) {
    let set2 = listeners.get(key2);
    if (set2)
      for (let fn of set2)
        try {
          fn(value);
        } catch (e) {
          log.error("listener for " + key2 + ": " + e.message);
        }
  }
  function listen(key2, fn) {
    return listeners.has(key2) || listeners.set(key2, /* @__PURE__ */ new Set()), listeners.get(key2).add(fn), () => listeners.get(key2)?.delete(fn);
  }
  function init() {
    if (teardown(), TAB_ID = makeTabId(), safe.BroadcastChannel)
      try {
        bc = new safe.BroadcastChannel("super-search"), bc.onmessage = (e) => {
          if (e?.data && e.data.src !== TAB_ID && listeners.has(e.data.key)) {
            let env = readEnv(e.data.key, void 0);
            fireLocal(e.data.key, env.v);
          }
        };
      } catch (e) {
        log.warn("BroadcastChannel init failed: " + e.message);
      }
    if (gm.addValueChangeListener)
      for (let key2 of [KEY_HIST, KEY_LOG, KEY_CLEAR])
        try {
          gm.addValueChangeListener(key2, (_k, _old, neu, remote) => {
            if (!remote) return;
            let env = readEnv(key2, void 0);
            fireLocal(key2, env.v);
          });
        } catch (e) {
          log.warn("addValueChangeListener failed: " + e.message);
        }
    else if (!bc) {
      log.info("cross-tab sync degraded to polling");
      for (let key2 of [KEY_HIST, KEY_LOG, KEY_CLEAR]) {
        let last = safe.jsonStringify(read(key2, null)), h = safe.setInterval(() => {
          let cur = safe.jsonStringify(read(key2, null));
          cur !== last && (last = cur, fireLocal(key2, read(key2, null)));
        }, 2e3);
        pollHandles.push(h);
      }
    }
  }
  function teardown() {
    try {
      bc?.close?.();
    } catch {
    }
    bc = null;
    for (let h of pollHandles) safe.clearInterval(h);
    pollHandles = [];
  }
  function readAll() {
    return {
      historical: sanitiseArr(read(KEY_HIST, [])),
      logEntries: sanitiseArr(read(KEY_LOG, [])),
      ui: read(KEY_UI, {}),
      clearedAt: Number(read(KEY_CLEAR, 0)) || 0,
      firstRunDone: !!read(KEY_FIRSTRUN, !1)
    };
  }
  function sanitiseArr(v) {
    return Array.isArray(v) ? v : [];
  }
  function writeUi(uiState) {
    write(KEY_UI, uiState);
  }
  function writeHistorical(arr) {
    write(KEY_HIST, capArray(arr));
  }
  function writeLog(arr) {
    write(KEY_LOG, capArray(arr));
  }
  function markFirstRunDone() {
    write(KEY_FIRSTRUN, !0);
  }
  function clearAll(ts) {
    let t = Number(ts) || safe.dateNow();
    write(KEY_CLEAR, t), write(KEY_HIST, []), write(KEY_LOG, []);
  }
  function capArray(arr) {
    return Array.isArray(arr) ? arr.length <= MAX_ENTRIES ? arr : arr.slice(arr.length - MAX_ENTRIES) : [];
  }
  function mergeHistorical(local, remote, clearedAt = 0) {
    let seen = /* @__PURE__ */ new Set(), out = [], all = [...sanitiseArr(local), ...sanitiseArr(remote)];
    all.sort((a, b) => (a.capturedAt || 0) - (b.capturedAt || 0));
    for (let m of all)
      !m || !m.id || (m.capturedAt || 0) < clearedAt || seen.has(m.id) || (seen.add(m.id), out.push(m));
    return out.length > MAX_ENTRIES ? out.slice(out.length - MAX_ENTRIES) : out;
  }

  // src/state.js
  var initial = () => ({
    // UI / control flags (persisted per-tab)
    query: "",
    mode: "text",
    // 'text' | 'selector' | 'js'
    live: !0,
    append: !1,
    dedupe: !1,
    log: { enabled: !1, win: !0, con: !1 },
    ui: { visible: !1, width: 390, height: "auto", listCollapsed: !1 },
    privacy: { incognito: !1, denylist: [] },
    // Cross-tab synced
    historical: [],
    logEntries: [],
    clearedAt: 0,
    // Runtime — not persisted
    matches: [],
    activeIndex: 0,
    inputError: null,
    // 'regex' | 'selector' | 'js' | 'redos' | null
    truncated: !1,
    submode: "empty",
    // 'plain' | 'regex' | 'timestamp' | 'selector' | 'js' | 'empty'
    lastJsResult: void 0,
    domSettled: !0,
    firstRun: !1
  }), state = initial(), subscribers = /* @__PURE__ */ new Set(), persistFn = null, isNotifying = !1, pendingNotify = !1;
  function get() {
    return state;
  }
  function set(patch) {
    state = { ...state, ...patch }, notify(), persistFn && schedulePersist();
  }
  function setDeep(patch) {
    let next = { ...state };
    for (let k in patch) {
      let v = patch[k];
      v && typeof v == "object" && !Array.isArray(v) && typeof next[k] == "object" ? next[k] = { ...next[k], ...v } : next[k] = v;
    }
    state = next, notify(), persistFn && schedulePersist();
  }
  function batch(fn) {
    let before = isNotifying;
    isNotifying = !0;
    try {
      fn();
    } finally {
      isNotifying = before, pendingNotify && !isNotifying && (pendingNotify = !1, notify());
    }
  }
  function notify() {
    if (isNotifying) {
      pendingNotify = !0;
      return;
    }
    isNotifying = !0;
    try {
      let snapshot = [...subscribers];
      for (let fn of snapshot)
        try {
          fn(state);
        } catch {
        }
    } finally {
      isNotifying = !1, pendingNotify && (pendingNotify = !1, notify());
    }
  }
  function subscribe(fn) {
    return subscribers.add(fn), () => subscribers.delete(fn);
  }
  var schedulePersist = debounce(200, () => {
    persistFn && persistFn(state);
  });
  function setPersistFn(fn) {
    persistFn = fn;
  }
  function hydrate(partial) {
    partial && (state = { ...state, ...partial }, notify());
  }
  function reset() {
    state = initial(), notify();
  }
  function flushPersist() {
    persistFn && (schedulePersist.cancel?.(), persistFn(state));
  }
  function mergeHistorical2(remote) {
    let cur = state.historical || [], merged = mergeHistorical(cur, remote || [], state.clearedAt || 0);
    state = { ...state, historical: merged }, notify();
  }
  function mergeLog(remote) {
    let cur = state.logEntries || [], merged = mergeHistorical(cur, remote || [], state.clearedAt || 0);
    state = { ...state, logEntries: merged }, notify();
  }

  // src/bus.js
  var handlers = /* @__PURE__ */ new Map();
  function on(event, fn) {
    return handlers.has(event) || handlers.set(event, /* @__PURE__ */ new Set()), handlers.get(event).add(fn), () => handlers.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    let set2 = handlers.get(event);
    if (set2)
      for (let fn of set2)
        try {
          fn(payload);
        } catch {
        }
  }

  // src/observer.js
  var DEBOUNCE_MS = 500, SETTLE_WINDOW_MS = 500, SETTLE_THRESHOLD = 5, AUTOPAUSE_RATE_LIMIT = 5, AUTOPAUSE_WINDOW_MS = 1e4, AUTOPAUSE_COOLDOWN_MS = 3e4, observer = null, settleTimer = null, mutationsThisWindow = 0, isSettled = !1, visibilityGet = () => !0, queryGet = () => "", liveGet = () => !0, recentTriggers = [], autoPaused = !1, lastPauseAt = 0, fireMutate = debounce(DEBOUNCE_MS, () => {
    if (autoPaused && safe.dateNow() - lastPauseAt > AUTOPAUSE_COOLDOWN_MS && (autoPaused = !1, recentTriggers = [], emit("observer-resumed"), log.info("observer auto-resumed after cooldown")), autoPaused || !visibilityGet() || !queryGet() || !liveGet()) return;
    recentTriggers.push(safe.dateNow());
    let cutoff = safe.dateNow() - AUTOPAUSE_WINDOW_MS;
    if (recentTriggers = recentTriggers.filter((t) => t >= cutoff), recentTriggers.length > AUTOPAUSE_RATE_LIMIT) {
      autoPaused = !0, lastPauseAt = safe.dateNow(), log.warn("observer auto-paused (too many DOM changes; will auto-resume after quiet)"), emit("observer-auto-paused");
      return;
    }
    emit("dom-changed");
  });
  function start(opts = {}) {
    if (stop(), autoPaused = !1, lastPauseAt = 0, recentTriggers = [], isSettled = !1, mutationsThisWindow = 0, visibilityGet = opts.visibilityGet || (() => !0), queryGet = opts.queryGet || (() => ""), liveGet = opts.liveGet || (() => !0), !safe.MutationObserver) {
      log.warn("MutationObserver unavailable");
      return;
    }
    let Mo = safe.MutationObserver;
    observer = new Mo(() => {
      mutationsThisWindow++, isSettled && (isSettled = !1, emit("dom-unsettled")), fireMutate();
    }), rebind(), settleTimer = safe.setInterval(() => {
      mutationsThisWindow < SETTLE_THRESHOLD ? isSettled || (isSettled = !0, emit("dom-settled")) : isSettled = !1, mutationsThisWindow = 0;
    }, SETTLE_WINDOW_MS);
  }
  function rebind() {
    if (observer)
      try {
        observer.disconnect(), observer.observe(document.body, { childList: !0, subtree: !0, characterData: !0 });
      } catch (e) {
        log.warn("observer rebind: " + e.message);
      }
  }
  function stop() {
    try {
      observer?.disconnect();
    } catch {
    }
    try {
      safe.clearInterval(settleTimer);
    } catch {
    }
    observer = null, settleTimer = null;
  }

  // src/nav.js
  var started = !1, origPush = null, origReplace = null;
  function start2() {
    if (!started) {
      started = !0;
      try {
        origPush = history.pushState.bind(history), origReplace = history.replaceState.bind(history), history.pushState = function(...args) {
          let r = origPush(...args);
          return emit("nav", { kind: "push" }), r;
        }, history.replaceState = function(...args) {
          let r = origReplace(...args);
          return emit("nav", { kind: "replace" }), r;
        };
      } catch (e) {
        log.warn("history patch failed: " + e.message);
      }
      window.addEventListener("popstate", () => emit("nav", { kind: "pop" })), window.addEventListener("hashchange", () => emit("nav", { kind: "hash" })), window.addEventListener("pagehide", () => emit("pagehide"));
    }
  }

  // src/ui/input.js
  var inputEl = null, goBtnEl = null, prevBtnEl = null, nextBtnEl = null, summaryEl = null, listeners2 = { onInput: null, onSubmit: null, onPrev: null, onNext: null, onEscape: null }, PLACEHOLDERS = {
    text: "Search (auto-detects /regex/ and timestamp ranges like 1:00-2:30)",
    selector: 'CSS selector (e.g. div.warning > p, a[href*="example.com"])',
    js: 'JavaScript (e.g. return [...document.querySelectorAll("a")].map(a=>a.href))'
  };
  function autoGrowIfMultiLine() {
    if (!inputEl || inputEl.classList.contains("ss-mode-js")) return;
    let lines = (inputEl.value.match(/\n/g) || []).length + 1;
    lines > 1 ? inputEl.rows = Math.min(lines, 4) : inputEl.rows = 1;
  }
  function build(state2) {
    return inputEl = el("textarea", {
      class: "ss-query",
      spellcheck: "false",
      autocomplete: "off",
      autocorrect: "off",
      rows: 1,
      "aria-label": "Search query",
      placeholder: PLACEHOLDERS.text
    }), inputEl.addEventListener("input", () => {
      autoGrowIfMultiLine(), listeners2.onInput?.(inputEl.value);
    }), inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault(), listeners2.onEscape?.();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        if (state2.get().mode === "js" && !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault(), listeners2.onSubmit?.();
      } else e.key === "Enter" && e.shiftKey && state2.get().mode !== "js" && (e.preventDefault(), listeners2.onPrev?.());
    }), goBtnEl = el("button", { type: "button", "aria-label": "Run search", onClick: () => listeners2.onSubmit?.() }, "Go"), prevBtnEl = el("button", { type: "button", title: "Previous match", "aria-label": "Previous match", onClick: () => listeners2.onPrev?.() }, "<"), nextBtnEl = el("button", { type: "button", title: "Next match", "aria-label": "Next match", onClick: () => listeners2.onNext?.() }, ">"), summaryEl = el("div", { class: "ss-summary", role: "status", "aria-live": "polite", "aria-atomic": "true" }, el("span", { class: "ss-counter" }, "-")), { row: el(
      "div",
      { class: "ss-input-row" },
      inputEl,
      el("div", { class: "ss-input-actions" }, goBtnEl, prevBtnEl, nextBtnEl)
    ), summary: summaryEl };
  }
  function setListeners(l) {
    Object.assign(listeners2, l);
  }
  function syncFromState(s) {
    if (!inputEl) return;
    inputEl.value !== s.query && (inputEl.value = s.query);
    let wasJsMode = inputEl.classList.contains("ss-mode-js");
    inputEl.classList.toggle("ss-mode-js", s.mode === "js"), inputEl.classList.toggle("ss-error", !!s.inputError), s.mode === "js" ? (inputEl.removeAttribute("rows"), inputEl.placeholder = PLACEHOLDERS.js) : (inputEl.placeholder = s.mode === "selector" ? PLACEHOLDERS.selector : PLACEHOLDERS.text, wasJsMode && (inputEl.style.height = ""), autoGrowIfMultiLine()), goBtnEl.hidden = s.live && s.mode !== "js";
    let matches = s.matches || [], counter = summaryEl.querySelector(".ss-counter");
    matches.length === 0 ? counter.textContent = s.query ? "0 matches" : "-" : s.append && Array.isArray(s.historical) && s.historical.length > 0 ? counter.textContent = `${s.activeIndex + 1} / ${matches.length} \xB7 list ${s.historical.length}` : counter.textContent = `${s.activeIndex + 1} / ${matches.length}`, prevBtnEl.disabled = matches.length === 0, nextBtnEl.disabled = matches.length === 0;
    let existing = summaryEl.querySelector(".ss-settling-dot");
    s.query && !s.domSettled ? existing || summaryEl.appendChild(el("span", { class: "ss-settling-dot", title: "Page still loading\u2026" })) : existing && existing.remove(), s.truncated ? summaryEl.querySelector(".ss-truncated") || summaryEl.appendChild(el("span", { class: "ss-truncated", style: { color: "#d83b01" } }, "(partial)")) : summaryEl.querySelector(".ss-truncated")?.remove();
  }

  // src/ui/controls.js
  var modeButtons = {}, liveCb = null, appendCb = null, dedupeCb = null, logCb = null, logWinCb = null, logConCb = null, copyBtn = null, clearBtn = null, dumpBtn = null, helpBtn = null, listeners3 = {};
  function build2() {
    let MODE_DESC = {
      text: "Text mode \u2014 plain text, auto-detects /regex/ and HH:MM:SS-HH:MM:SS ranges",
      selector: "CSS selector mode \u2014 querySelectorAll syntax (e.g. div.warning > p)",
      js: "JS mode \u2014 run JavaScript in the page realm (return value classified)"
    }, makeModeBtn = (m, label) => el("button", {
      type: "button",
      role: "radio",
      "aria-label": MODE_DESC[m],
      "aria-checked": "false",
      title: MODE_DESC[m],
      "data-mode": m,
      onClick: () => listeners3.onMode?.(m)
    }, label);
    modeButtons.text = makeModeBtn("text", "Text"), modeButtons.selector = makeModeBtn("selector", "CSS"), modeButtons.js = makeModeBtn("js", "JS"), liveCb = el("input", {
      type: "checkbox",
      "aria-label": "Live mode \u2014 search as you type",
      title: "Live: search as you type (100ms debounce). Off = manual via Go / Enter.",
      onChange: (e) => listeners3.onToggle?.("live", e.target.checked)
    }), appendCb = el("input", {
      type: "checkbox",
      "aria-label": "Append matches across pages and tabs",
      title: `Append: collect match VALUES into one running list across all tabs.
Use for cross-tab triage workflows (e.g. scan 20 tabs, copy results).`,
      onChange: (e) => listeners3.onToggle?.("append", e.target.checked)
    }), dedupeCb = el("input", {
      type: "checkbox",
      "aria-label": "Dedupe matches in the list",
      title: "Dedupe: hide duplicate rows in the displayed list (display-only).",
      onChange: (e) => listeners3.onToggle?.("dedupe", e.target.checked)
    }), logCb = el("input", {
      type: "checkbox",
      "aria-label": "Log matches with timestamps and URLs",
      title: `Log: audit trail with timestamp + URL of every find.
Different from Append \u2014 Append stores values; Log stores history of finds.`,
      onChange: (e) => listeners3.onToggle?.("log", e.target.checked)
    }), logWinCb = el("input", {
      type: "checkbox",
      "aria-label": "Show log in panel",
      title: "Win: show log entries in the panel.",
      onChange: (e) => listeners3.onToggle?.("log.win", e.target.checked)
    }), logConCb = el("input", {
      type: "checkbox",
      "aria-label": "Mirror log to browser console",
      title: "Con: mirror log entries to the browser DevTools console.",
      onChange: (e) => listeners3.onToggle?.("log.con", e.target.checked)
    }), copyBtn = el("button", {
      type: "button",
      "aria-label": "Copy match list to clipboard",
      title: "Copy the visible match list to clipboard (tab-separated, with source URLs).",
      onClick: () => listeners3.onCopy?.()
    }, "Copy"), dumpBtn = el("button", {
      type: "button",
      hidden: !0,
      "aria-label": "Dump JS result to window.superSearchResults",
      title: "Dump the last JS query result to window.superSearchResults so you can inspect it in DevTools.",
      onClick: () => listeners3.onDump?.()
    }, "Dump"), clearBtn = el("button", {
      type: "button",
      "aria-label": "Clear all matches and history",
      title: "Clear matches, accumulated list, and log (cross-tab synced).",
      onClick: () => listeners3.onClearAll?.()
    }, "Clear"), helpBtn = el("button", {
      type: "button",
      class: "ss-help-btn",
      "aria-label": "Show help",
      title: "Show help / keyboard shortcuts / examples",
      onClick: () => listeners3.onHelp?.()
    }, "?");
    let modePicker = el("div", {
      class: "ss-mode-picker",
      role: "radiogroup",
      "aria-label": "Search mode",
      onKeydown: (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        let order = ["text", "selector", "js"], cur = e.target?.dataset?.mode, idx = order.indexOf(cur);
        if (idx === -1) return;
        let next = e.key === "ArrowRight" ? order[(idx + 1) % order.length] : order[(idx - 1 + order.length) % order.length];
        modeButtons[next].focus(), listeners3.onMode?.(next);
      }
    }, modeButtons.text, modeButtons.selector, modeButtons.js), logTargets = el(
      "span",
      { class: "ss-log-targets", hidden: !0 },
      el("label", { title: "Win: show log in the panel" }, logWinCb, "Win"),
      el("label", { title: "Con: mirror log to DevTools console" }, logConCb, "Con")
    ), controls = el(
      "div",
      { class: "ss-controls" },
      el("label", { title: "Live: search as you type. JS mode is always manual." }, liveCb, "Live"),
      el("label", { title: "Append: collect match values across all tabs" }, appendCb, "Append"),
      el("label", { title: "Dedupe: hide duplicate rows" }, dedupeCb, "Dedupe"),
      el("label", { title: "Log: audit trail with timestamps + URLs" }, logCb, "Log"),
      logTargets,
      copyBtn,
      dumpBtn,
      clearBtn,
      helpBtn
    );
    return modeButtons.__logTargets = logTargets, el("div", { class: "ss-header" }, modePicker, controls);
  }
  function setListeners2(l) {
    listeners3 = l;
  }
  function syncFromState2(s) {
    if (modeButtons.text) {
      for (let m of ["text", "selector", "js"]) {
        let sel = s.mode === m;
        modeButtons[m].setAttribute("aria-checked", sel ? "true" : "false"), modeButtons[m].setAttribute("aria-pressed", sel ? "true" : "false"), modeButtons[m].tabIndex = sel ? 0 : -1;
      }
      liveCb.checked = !!s.live, appendCb.checked = !!s.append, dedupeCb.checked = !!s.dedupe, logCb.checked = !!s.log?.enabled, logWinCb.checked = !!s.log?.win, logConCb.checked = !!s.log?.con, modeButtons.__logTargets && (modeButtons.__logTargets.hidden = !s.log?.enabled), dumpBtn.hidden = !(s.mode === "js" && s.lastJsResultPresent);
    }
  }

  // src/ui/matchList.js
  var listEl = null, regionEl = null, headerEl = null, listeners4 = {};
  function build3() {
    return listEl = el("ul", { class: "ss-list", role: "list" }), headerEl = el("button", {
      type: "button",
      class: "ss-list-header",
      "aria-expanded": "true",
      "aria-label": "Toggle match list",
      title: "Click to collapse / expand the match list",
      onClick: () => listeners4.onToggleCollapse?.()
    }, "Found Matches", el("span", { class: "ss-collapse" }, "\u25BE")), regionEl = el("div", { class: "ss-list-region" }, headerEl, listEl), regionEl;
  }
  function urlBadgeText(url) {
    try {
      let u = new URL(url), seg = u.pathname.split("/").filter(Boolean)[0];
      return seg ? `${u.host}/${seg}\u2026` : u.host;
    } catch {
      return String(url || "").slice(0, 30);
    }
  }
  function setListeners3(l) {
    listeners4 = l;
  }
  function syncFromState3(s, opts = {}) {
    if (!listEl) return;
    let data = s.append ? s.historical || [] : s.matches || [], shown = s.dedupe ? dedupe(data) : data, collapsed = !!s.ui?.listCollapsed;
    if (clear(listEl), regionEl.classList.toggle("ss-collapsed", collapsed), headerEl && headerEl.setAttribute("aria-expanded", collapsed ? "false" : "true"), collapsed) {
      listEl.style.display = "none";
      return;
    }
    listEl.style.display = "";
    let MAX_RENDERED2 = 500, rendered = shown.slice(0, MAX_RENDERED2);
    for (let i = 0; i < rendered.length; i++) {
      let m = rendered[i], isActive = !s.append && i === s.activeIndex, activate = () => listeners4.onRowClick?.(m, i, s.append), li = el(
        "li",
        {
          class: isActive ? "ss-active" : "",
          tabindex: "0",
          role: "button",
          "aria-label": `Match ${i + 1}: ${m.value || ""}`,
          "aria-current": isActive ? "true" : null,
          onClick: activate,
          onKeydown: (e) => {
            (e.key === "Enter" || e.key === " ") && (e.preventDefault(), activate());
          }
        },
        el("span", { class: "ss-row-num" }, String(i + 1) + "."),
        el(
          "span",
          { class: "ss-row-text" },
          m.before,
          el("span", { class: "ss-row-match" }, m.value),
          m.after
        )
      );
      if (m.sourceUrl) {
        let here = canonicalUrl(opts.currentUrl || location.href), there = canonicalUrl(m.sourceUrl);
        if (there && there !== here) {
          let badge = el("span", { class: "ss-row-url", title: "from " + m.sourceUrl }, urlBadgeText(m.sourceUrl));
          li.appendChild(badge);
        }
      }
      listEl.appendChild(li);
    }
    shown.length > MAX_RENDERED2 && listEl.appendChild(el("li", { style: { color: "#888" } }, `\u2026 and ${shown.length - MAX_RENDERED2} more`));
  }
  function canonicalUrl(url) {
    if (!url) return "";
    try {
      let u = new URL(url);
      return u.origin + u.pathname;
    } catch {
      return String(url);
    }
  }
  function dedupe(arr) {
    let seen = /* @__PURE__ */ new Set(), out = [];
    for (let m of arr) {
      let key2 = m.id || `${m.value}|${m.before}|${m.after}|${m.sourceUrl}`;
      seen.has(key2) || (seen.add(key2), out.push(m));
    }
    return out;
  }

  // src/util/treeWalker.js
  var SKIP_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]), DEFAULT_NODE_BUDGET = 1e5, DEFAULT_TIME_BUDGET_MS = 500, DEFAULT_PER_NODE_LEN_CAP = 5e4;
  function walkTextNodes(root2, opts = {}) {
    let shouldSkip = opts.shouldSkip || (() => !1), nodeBudget = opts.nodeBudget ?? DEFAULT_NODE_BUDGET, timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS, startTs = safe.dateNow(), nodesSeen = 0, truncated = !1;
    function* gen() {
      if (!root2) return;
      let stack = [root2];
      for (; stack.length; ) {
        let node = stack.pop();
        if (node) {
          if (node.nodeType === 1) {
            if (SKIP_TAGS.has(node.tagName) || isEditable(node) || shouldSkip(node)) continue;
            let children = node.childNodes;
            for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
            continue;
          }
          if (node.nodeType === 3) {
            if (nodesSeen++, nodesSeen > nodeBudget) {
              truncated = !0;
              return;
            }
            if ((nodesSeen & 1023) === 0 && safe.dateNow() - startTs > timeBudgetMs) {
              truncated = !0;
              return;
            }
            yield node;
            continue;
          }
          if (node.childNodes && node.childNodes.length)
            for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
        }
      }
    }
    return {
      nodes: gen(),
      stats: () => ({ nodesSeen, timeMs: safe.dateNow() - startTs, truncated })
    };
  }
  function isEditable(el2) {
    if (!el2 || el2.nodeType !== 1) return !1;
    if (el2.isContentEditable === !0) return !0;
    let a = el2.getAttribute && el2.getAttribute("contenteditable");
    if (a === "true" || a === "") return !0;
    let tag = el2.tagName;
    return tag === "INPUT" || tag === "TEXTAREA";
  }

  // src/util/textNormalise.js
  var ZW = /[​-‍﻿­⁠⁡-⁤]/, SPACE_LIKE = /[     ]/;
  function normaliseForMatch(s) {
    if (s == null || s === "") return { normalised: "", indexMap: [] };
    let out = "", map = [];
    for (let i = 0; i < s.length; i++) {
      let ch = s[i];
      if (!ZW.test(ch)) {
        if (SPACE_LIKE.test(ch)) {
          out += " ", map.push(i);
          continue;
        }
        out += ch, map.push(i);
      }
    }
    return { normalised: out, indexMap: map };
  }
  function normaliseQuery(s) {
    if (s == null) return "";
    let out = "";
    for (let i = 0; i < s.length; i++) {
      let ch = s[i];
      if (!ZW.test(ch)) {
        if (SPACE_LIKE.test(ch)) {
          out += " ";
          continue;
        }
        out += ch;
      }
    }
    return out;
  }

  // src/util/matchId.js
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++)
      h ^= s.charCodeAt(i), h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    return h.toString(36);
  }
  var esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  function matchIdFor({ value, before, after, sourceUrl }) {
    return "m_" + hashStr(`${esc(sourceUrl)}|${esc(before)}|${esc(value)}|${esc(after)}`);
  }

  // src/util/contextSnippet.js
  function buildContext(textNode, start3, end, contextLen = 30) {
    let value = textNode.nodeValue, before = value.substring(Math.max(0, start3 - contextLen), start3), after = value.substring(end, Math.min(value.length, end + contextLen));
    return { before, after };
  }

  // src/search/text.js
  function run(query, root2, opts = {}) {
    let sourceUrl = opts.sourceUrl || (typeof location < "u" ? location.href : "");
    if (!query) return { matches: [], truncated: !1, nodesSeen: 0 };
    let needle = normaliseQuery(query).toLowerCase();
    if (!needle || needle.trim() === "") return { matches: [], truncated: !1, nodesSeen: 0 };
    let matches = [], w = walkTextNodes(root2, opts);
    for (let node of w.nodes) {
      let raw = node.nodeValue;
      if (!raw || raw.length > (opts.perNodeLenCap ?? DEFAULT_PER_NODE_LEN_CAP)) continue;
      let { normalised, indexMap } = normaliseForMatch(raw), haystack = normalised.toLowerCase(), i = 0;
      for (; i <= haystack.length - needle.length; ) {
        let found = haystack.indexOf(needle, i);
        if (found === -1) break;
        let origStart = indexMap[found] ?? found, lastNormIdx = found + needle.length - 1, origEnd = (indexMap[lastNormIdx] ?? lastNormIdx) + 1, range = document.createRange();
        try {
          range.setStart(node, origStart), range.setEnd(node, origEnd);
        } catch {
          i = found + needle.length;
          continue;
        }
        let value = raw.substring(origStart, origEnd), { before, after } = buildContext(node, origStart, origEnd);
        matches.push({
          id: matchIdFor({ value, before, after, sourceUrl }),
          kind: "text",
          range,
          element: null,
          value,
          before,
          after,
          sourceUrl,
          capturedAt: safe.dateNow(),
          capturedNodeLength: raw.length
        }), i = found + needle.length;
      }
    }
    let s = w.stats();
    return { matches, truncated: s.truncated, nodesSeen: s.nodesSeen };
  }

  // src/search/regex.js
  var RegexParseError = class extends Error {
  }, DANGEROUS = /\([^)]*[+*?][^)]*\)[+*]/;
  function looksDangerous(pattern) {
    return DANGEROUS.test(pattern);
  }
  function parseRegexLiteral(s) {
    try {
      let m = s.match(/^\/(.+)\/([gimsuy]*)$/s), pattern, flags;
      if (m ? (pattern = m[1], flags = m[2] || "", !flags.includes("g") && !flags.includes("y") && (flags += "g")) : (pattern = s, flags = "gi"), looksDangerous(pattern))
        throw new RegexParseError("Pattern may cause catastrophic backtracking; refusing.");
      return new RegExp(pattern, flags);
    } catch (e) {
      throw e instanceof RegexParseError ? e : new RegexParseError(e.message);
    }
  }
  var PER_REGEX_TIME_BUDGET_MS = 500;
  function run2(input, root2, opts = {}) {
    let sourceUrl = opts.sourceUrl || (typeof location < "u" ? location.href : ""), re;
    try {
      if (input instanceof RegExp) {
        if (looksDangerous(input.source)) throw new RegexParseError("Pattern may cause catastrophic backtracking; refusing.");
        let f = input.flags, flags = f.includes("g") || f.includes("y") ? f : f + "g";
        re = new RegExp(input.source, flags);
      } else
        re = parseRegexLiteral(input);
    } catch (e) {
      throw e instanceof RegexParseError ? e : new RegexParseError(e.message);
    }
    let matches = [], w = walkTextNodes(root2, opts), startTs = safe.dateNow(), regexTimedOut = !1;
    for (let node of w.nodes) {
      if (regexTimedOut) break;
      let raw = node.nodeValue;
      if (!raw || raw.length > (opts.perNodeLenCap ?? DEFAULT_PER_NODE_LEN_CAP)) continue;
      re.lastIndex = 0;
      let m, iter = 0;
      for (; (m = re.exec(raw)) !== null; ) {
        if (iter++, (iter & 63) === 0 && safe.dateNow() - startTs > PER_REGEX_TIME_BUDGET_MS) {
          regexTimedOut = !0;
          break;
        }
        let start3 = m.index, end = m.index + m[0].length;
        if (!(m.index === re.lastIndex && (re.lastIndex++, m[0].length === 0)) && end > start3) {
          let range = document.createRange();
          try {
            range.setStart(node, start3), range.setEnd(node, end);
          } catch {
            continue;
          }
          let value = m[0], { before, after } = buildContext(node, start3, end);
          matches.push({
            id: matchIdFor({ value, before, after, sourceUrl }),
            kind: "regex",
            range,
            element: null,
            value,
            before,
            after,
            sourceUrl,
            capturedAt: safe.dateNow(),
            capturedNodeLength: raw.length
          });
        }
      }
    }
    let s = w.stats();
    return { matches, truncated: s.truncated || regexTimedOut, nodesSeen: s.nodesSeen, regexTimedOut };
  }

  // src/util/timeParse.js
  function timeToSeconds(s) {
    if (typeof s != "string") return NaN;
    let parts = s.split(":").map(Number);
    return parts.some((p) => Number.isNaN(p) || p < 0) ? NaN : parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : NaN;
  }
  function parseRange(rangeStr) {
    let m = rangeStr.match(/^(\d{1,2}(?::\d{2}){1,2})-(\d{1,2}(?::\d{2}){1,2})$/);
    if (!m) return null;
    let lo = timeToSeconds(m[1]), hi = timeToSeconds(m[2]);
    return Number.isNaN(lo) || Number.isNaN(hi) ? null : { lo, hi };
  }
  var TOKEN_RX = /\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g;

  // src/search/timestamp.js
  function run3(query, root2, opts = {}) {
    let sourceUrl = opts.sourceUrl || (typeof location < "u" ? location.href : ""), range = parseRange(query);
    if (!range) return { matches: [], truncated: !1, nodesSeen: 0 };
    if (range.lo > range.hi)
      return { matches: [], truncated: !1, nodesSeen: 0, error: "inverted-range" };
    let matches = [], w = walkTextNodes(root2, opts);
    for (let node of w.nodes) {
      let raw = node.nodeValue;
      if (!raw || raw.length > (opts.perNodeLenCap ?? DEFAULT_PER_NODE_LEN_CAP)) continue;
      let re = new RegExp(TOKEN_RX.source, "g"), m;
      for (; (m = re.exec(raw)) !== null; ) {
        let tok = m[0], secs = timeToSeconds(tok);
        if (Number.isNaN(secs) || secs < range.lo || secs > range.hi) continue;
        let start3 = m.index, end = start3 + tok.length, r = document.createRange();
        try {
          r.setStart(node, start3), r.setEnd(node, end);
        } catch {
          continue;
        }
        let { before, after } = buildContext(node, start3, end);
        matches.push({
          id: matchIdFor({ value: tok, before, after, sourceUrl }),
          kind: "timestamp",
          range: r,
          element: null,
          value: tok,
          before,
          after,
          sourceUrl,
          capturedAt: safe.dateNow(),
          capturedNodeLength: raw.length
        });
      }
    }
    let s = w.stats();
    return { matches, truncated: s.truncated, nodesSeen: s.nodesSeen };
  }

  // src/search/selector.js
  var SelectorError = class extends Error {
  }, MAX_ELEMENTS = 5e3;
  function run4(query, root2, opts = {}) {
    let sourceUrl = opts.sourceUrl || (typeof location < "u" ? location.href : ""), nodes;
    try {
      nodes = root2.querySelectorAll(query);
    } catch (e) {
      throw new SelectorError(e.message);
    }
    let matches = [], truncated = !1;
    for (let i = 0; i < nodes.length; i++) {
      if (i >= MAX_ELEMENTS) {
        truncated = !0;
        break;
      }
      let el2 = nodes[i], text = (el2.innerText || el2.textContent || "").trim().slice(0, 60), tagDesc = describe(el2);
      matches.push({
        id: matchIdFor({ value: tagDesc, before: "", after: text, sourceUrl: sourceUrl + "#" + i }),
        kind: "selector",
        range: null,
        element: el2,
        value: tagDesc,
        before: "",
        after: text,
        sourceUrl,
        capturedAt: safe.dateNow(),
        capturedNodeLength: 0
      });
    }
    return { matches, truncated, nodesSeen: matches.length };
  }
  function describe(el2) {
    let s = el2.tagName ? el2.tagName.toLowerCase() : "node";
    return el2.id && (s += "#" + el2.id), el2.classList && el2.classList.length && (s += "." + Array.from(el2.classList).slice(0, 3).join(".")), `<${s}>`;
  }

  // src/search/jsquery.js
  var JsError = class extends Error {
  };
  function run5(query, root2, opts = {}) {
    let sourceUrl = opts.sourceUrl || (typeof location < "u" ? location.href : ""), result;
    try {
      let u = gm.unsafeWindow;
      if (u && typeof u.eval == "function") {
        if (result = u.eval(`(function(){ ${query} })()`), result === void 0)
          try {
            result = u.eval(query);
          } catch {
          }
      } else if (result = (0, eval)(`(function(){ ${query} })()`), result === void 0)
        try {
          result = (0, eval)(query);
        } catch {
        }
    } catch (e) {
      throw new JsError(e?.message || String(e));
    }
    let classified;
    try {
      classified = classify(result, sourceUrl);
    } catch {
      return { matches: [], truncated: !1, nodesSeen: 0, lastJsResult: "<unrepresentable>" };
    }
    return { ...classified, lastJsResult: result };
  }
  function classify(result, sourceUrl) {
    let matches = [], pushElem = (el2, idx) => {
      if (!el2 || el2.nodeType !== 1) return;
      let desc = describe2(el2), text = (el2.innerText || el2.textContent || "").trim().slice(0, 60);
      matches.push({
        id: matchIdFor({ value: desc, before: "", after: text, sourceUrl: sourceUrl + "#" + idx }),
        kind: "js-element",
        range: null,
        element: el2,
        value: desc,
        before: "",
        after: text,
        sourceUrl,
        capturedAt: safe.dateNow(),
        capturedNodeLength: 0
      });
    }, pushString = (s, idx) => {
      let val = String(s);
      matches.push({
        id: matchIdFor({ value: val, before: "", after: "", sourceUrl: sourceUrl + "#js#" + idx }),
        kind: "js-string",
        range: null,
        element: null,
        value: val,
        before: "",
        after: "",
        sourceUrl,
        capturedAt: safe.dateNow(),
        capturedNodeLength: 0
      });
    };
    if (result == null)
      pushString(String(result), 0);
    else if (typeof result == "object" && typeof result.then == "function")
      pushString("<Promise \u2014 JS mode does not await; use a synchronous expression>", 0);
    else if (typeof result == "object" && result.nodeType === 1)
      pushElem(result, 0);
    else if (typeof result == "object" && (result instanceof Array || isNodeListLike(result))) {
      let arr = Array.from(result);
      arr.length === 0 || (arr[0] && typeof arr[0] == "object" && arr[0].nodeType === 1 ? arr.forEach((el2, i) => pushElem(el2, i)) : arr.forEach((v, i) => pushString(v, i)));
    } else
      pushString(result, 0);
    return { matches, truncated: !1, nodesSeen: matches.length };
  }
  function isNodeListLike(o) {
    if (!o || typeof o.length != "number") return !1;
    let c = o.constructor?.name || "";
    return c === "NodeList" || c === "HTMLCollection" || typeof o.item == "function" && typeof o.length == "number";
  }
  function describe2(el2) {
    let s = el2.tagName ? el2.tagName.toLowerCase() : "node";
    return el2.id && (s += "#" + el2.id), el2.classList && el2.classList.length && (s += "." + Array.from(el2.classList).slice(0, 3).join(".")), `<${s}>`;
  }

  // src/search/dispatcher.js
  var RX_REGEX = /^\/(.+)\/([gimsuy]*)$/s, RX_TIMESTAMP = /^\d{1,2}(:\d{2}){1,2}-\d{1,2}(:\d{2}){1,2}$/, strategies = {
    text: run,
    regex: run2,
    timestamp: run3,
    selector: run4,
    js: run5
  };
  function detectTextSubmode(query) {
    return query ? RX_REGEX.test(query) ? "regex" : RX_TIMESTAMP.test(query) ? "timestamp" : "plain" : "empty";
  }
  function dispatch({ query, mode, root: root2, sourceUrl }) {
    if (query == null || query === "") return { matches: [], error: null, submode: "empty", truncated: !1 };
    typeof query != "string" && (query = String(query)), root2 = root2 || document.body;
    let ctx = { sourceUrl };
    try {
      if (mode === "selector") {
        let fn = strategies.selector;
        return fn ? { ...fn(query, root2, ctx), error: null, submode: "selector" } : { matches: [], error: null, submode: "selector" };
      }
      if (mode === "js") {
        let fn = strategies.js;
        return fn ? { ...fn(query, root2, ctx), error: null, submode: "js" } : { matches: [], error: null, submode: "js" };
      }
      let submode = detectTextSubmode(query);
      if (submode === "regex")
        return { ...run2(query, root2, ctx), error: null, submode };
      if (submode === "timestamp") {
        let fn = strategies.timestamp;
        if (fn) return { ...fn(query, root2, ctx), error: null, submode };
      }
      return { ...run(query, root2, ctx), error: null, submode: "plain" };
    } catch (e) {
      return e instanceof RegexParseError ? { matches: [], error: "regex", submode: "regex" } : e instanceof SelectorError ? { matches: [], error: "selector", submode: "selector" } : e instanceof JsError ? { matches: [], error: "js", submode: "js", jsErrorMessage: e.message } : { matches: [], error: errorKind(mode), submode: mode };
    }
  }
  function errorKind(mode) {
    return mode === "selector" ? "selector" : mode === "js" ? "js" : "unknown";
  }

  // src/highlight.js
  var ALL_NAME = "ss-all", ACTIVE_NAME = "ss-active", allHL = null, activeHL = null, installed = !1, styleElRef = null;
  function isAvailable() {
    return !!(safe.cssHighlights && safe.Highlight);
  }
  function install() {
    if (!installed) {
      if (!isAvailable()) {
        installed = !0;
        return;
      }
      try {
        allHL = new safe.Highlight(), activeHL = new safe.Highlight(), safe.cssHighlights.set(ALL_NAME, allHL), safe.cssHighlights.set(ACTIVE_NAME, activeHL), installed = !0;
      } catch {
        installed = !0;
      }
    }
  }
  function installStyles() {
    if (typeof document > "u" || styleElRef && styleElRef.isConnected) return;
    let style = document.createElement("style");
    style.textContent = `
    ::highlight(${ALL_NAME})    { background-color: #C04AC0; color: #000; }
    ::highlight(${ACTIVE_NAME}) { background-color: #32CD32; color: #000; }
  `, (document.head || document.documentElement).appendChild(style), styleElRef = style;
  }
  function setMatches(matches, activeIndex) {
    if (install(), !!isAvailable() && !(!allHL || !activeHL)) {
      allHL.clear(), activeHL.clear();
      for (let i = 0; i < matches.length; i++) {
        let m = matches[i];
        if (!(!m || !m.range))
          try {
            i === activeIndex ? activeHL.add(m.range) : allHL.add(m.range);
          } catch {
          }
      }
    }
  }
  function setActiveOnly(matches, activeIndex) {
    if (install(), !(!isAvailable() || !allHL || !activeHL)) {
      activeHL.clear(), allHL.clear();
      for (let i = 0; i < matches.length; i++) {
        let m = matches[i];
        if (!(!m || !m.range))
          try {
            i === activeIndex ? activeHL.add(m.range) : allHL.add(m.range);
          } catch {
          }
      }
    }
  }

  // src/elementHighlight.js
  var OUTLINE_DASHED = "2px dashed #FF69B4", OUTLINE_SOLID = "2px solid #32CD32", SHADOW_SOLID = "0 0 6px #32CD32", PREV_OUTLINE = "ssPrevOutline", PREV_SHADOW = "ssPrevBoxShadow", outlined = [];
  function applyOutlines(matches, activeIndex) {
    restore();
    for (let i = 0; i < matches.length; i++) {
      let el2 = matches[i].element;
      !el2 || el2.nodeType !== 1 || el2.isConnected && (save(el2), i === activeIndex ? (el2.style.outline = OUTLINE_SOLID, el2.style.boxShadow = SHADOW_SOLID) : el2.style.outline = OUTLINE_DASHED, outlined.push(el2));
    }
  }
  function save(el2) {
    el2.dataset[PREV_OUTLINE] === void 0 && (el2.dataset[PREV_OUTLINE] = el2.style.outline || ""), el2.dataset[PREV_SHADOW] === void 0 && (el2.dataset[PREV_SHADOW] = el2.style.boxShadow || "");
  }
  function restore() {
    for (let el2 of outlined)
      !el2 || !el2.style || (el2.style.outline = el2.dataset[PREV_OUTLINE] || "", el2.style.boxShadow = el2.dataset[PREV_SHADOW] || "", delete el2.dataset[PREV_OUTLINE], delete el2.dataset[PREV_SHADOW]);
    outlined = [];
  }

  // src/navigate.js
  function indexOfNext(cur, len) {
    return len === 0 ? 0 : (cur + 1) % len;
  }
  function indexOfPrev(cur, len) {
    return len === 0 ? 0 : (cur - 1 + len) % len;
  }
  function nextIndex(cur, len) {
    return indexOfNext(cur, len);
  }
  function prevIndex(cur, len) {
    return indexOfPrev(cur, len);
  }
  function scrollToMatch(m) {
    if (!m) return;
    let el2 = m.element || m.range && m.range.commonAncestorContainer?.parentElement;
    if (!el2 || !el2.scrollIntoView) return;
    let reduce = !1;
    try {
      reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
    }
    try {
      el2.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    } catch {
      try {
        el2.scrollIntoView();
      } catch {
      }
    }
  }

  // src/lifecycle.js
  function isAlive(m) {
    if (!m) return !1;
    if (m.range) {
      let node = m.range.startContainer;
      return !(!node || !node.isConnected || m.capturedNodeLength != null && node.nodeType === 3 && (node.nodeValue == null ? 0 : node.nodeValue.length) !== m.capturedNodeLength);
    }
    return m.element ? m.element.isConnected === !0 : m.kind === "js-string";
  }
  function pruneDead(matches) {
    return Array.isArray(matches) ? matches.filter(isAlive) : [];
  }
  function adjustIndex(idx, oldLen, newLen) {
    return newLen === 0 || idx < 0 ? 0 : idx >= newLen ? newLen - 1 : idx;
  }

  // src/ui/logView.js
  var region = null, listEl2 = null, MAX_RENDERED = 100;
  function build4() {
    return listEl2 = el("ul", { class: "ss-log" }), region = el("div", { class: "ss-log-region" }, listEl2), region;
  }
  function syncFromState4(s) {
    if (!region) return;
    let visible = !!(s.log?.enabled && s.log?.win);
    if (region.classList.toggle("ss-visible", visible), !visible) return;
    clear(listEl2);
    let entries2 = (s.logEntries || []).slice(-MAX_RENDERED).reverse();
    for (let e of entries2) {
      let row = el(
        "li",
        {},
        el("span", { class: "ss-log-ts" }, "[" + shortTs(e.ts) + "] "),
        el("span", { class: "ss-log-kind" }, e.kind + ": ")
      );
      e.before && row.appendChild(el("span", { class: "ss-log-ctx" }, e.before)), row.appendChild(el("span", { class: "ss-log-match" }, e.value || "")), e.after && row.appendChild(el("span", { class: "ss-log-ctx" }, e.after)), e.sourceUrl && row.appendChild(el("span", { class: "ss-log-url", title: e.sourceUrl }, " \xB7 " + shortUrl(e.sourceUrl))), listEl2.appendChild(row);
    }
    for (let d of getEntries().filter((x) => x.level === "error").slice(-5).reverse())
      listEl2.appendChild(el("li", { class: "ss-log-error" }, "! " + d.msg));
  }
  function shortUrl(url) {
    try {
      let u = new URL(url);
      return u.host + (u.pathname && u.pathname !== "/" ? u.pathname.slice(0, 20) : "");
    } catch {
      return String(url).slice(0, 30);
    }
  }
  function shortTs(iso) {
    if (typeof iso != "string") return "";
    let m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
    return m ? m[1] : iso;
  }

  // src/ui/helpView.js
  var modalEl = null, SECTIONS = [
    {
      h: "Keyboard",
      rows: [
        ["Ctrl+Shift+F", "Toggle the panel"],
        ["Enter", "Next match (in Text / CSS mode)"],
        ["Shift+Enter", "Previous match"],
        ["Ctrl+Enter", "Run JS query (in JS mode)"],
        ["Escape", "Hide panel"],
        ["Arrow Left / Right", "Switch search mode"]
      ]
    },
    {
      h: "Search modes",
      items: [
        {
          title: "Text",
          body: "Plain text, case-insensitive. Auto-detects regex if wrapped in slashes and timestamp ranges.",
          examples: [
            ["lorem ipsum", "plain text"],
            ["/error \\d+/gi", "regex with flags"],
            ["1:00-2:30", "find timestamps in this range"],
            ["01:00:00-02:30:00", "HH:MM:SS form"]
          ]
        },
        {
          title: "CSS",
          body: "CSS selectors (querySelectorAll). Matched elements get a dashed pink outline.",
          examples: [
            ["div.warning > p", "descendant selectors"],
            ['a[href*="example.com"]', "attribute filters"],
            ["[data-id]:not(.hidden)", "pseudo-class + attribute"],
            ["table tr:nth-child(odd)", "positional selectors"]
          ]
        },
        {
          title: "JS",
          body: `Run JavaScript in the page realm. Result is classified:
  Element / NodeList \u2192 highlighted on page
  Array of strings \u2192 shown in the match list
  Anything else \u2192 coerced to string
The Dump button copies the last result to window.superSearchResults so you can grab it from DevTools.`,
          examples: [
            ["return document.title", "a single value"],
            ['return [...document.querySelectorAll("a")].map(a=>a.href)', "array of strings"],
            ['return document.querySelector("#main")', "an element"],
            ["return Array.from(document.images).map(i=>i.src)", "all image URLs"]
          ]
        }
      ]
    },
    {
      h: "Options",
      items: [
        {
          title: "Live",
          body: "Search as you type (100ms debounce). Off \u2192 manual via Go button or Enter. JS mode is always manual to avoid eval'ing half-typed expressions."
        },
        {
          title: "Append",
          body: `Collect match values into one running list across all tabs.
Use this when you're scanning N tabs to gather results, e.g. searching for the same product across 20 shopping pages and copying the list out. Persists across reloads and tabs.`
        },
        {
          title: "Dedupe",
          body: "Display-only filter: hide duplicate rows. Combine with Append for a unique cross-tab collection."
        },
        {
          title: "Log",
          body: `Different from Append. Log is an audit trail with timestamps + URLs of every find. Use this when you want to know when and where a value appeared, not just collect the values.
Log dedupes by (value, before, after, url) within a session so live-mode typing isn't spammy.`
        }
      ]
    },
    {
      h: "Buttons",
      items: [
        { title: "Go", body: "Run search manually (visible when Live is off, or always in JS mode)." },
        { title: "< / >", body: "Previous / next match. Same as Shift+Enter / Enter inside the search box." },
        { title: "Copy", body: "Copy the visible match list to the clipboard, tab-separated. Cross-page rows include their URL." },
        { title: "Dump", body: "Only visible after a JS query. Writes the result to window.superSearchResults for inspection in DevTools." },
        { title: "Clear", body: "Clears matches + accumulated list + log. Cross-tab synced \u2014 clears on all your tabs." }
      ]
    },
    {
      h: "Tips",
      items: [
        { title: "Shortcut blocked by host page", body: 'Some sites capture Ctrl+Shift+F (Notion, Slack, Google Docs). Use the Tampermonkey extension menu: "Super Search: Toggle panel".' },
        { title: "Single-page apps", body: 'Search auto re-runs on SPA navigation and DOM updates. If the page is "settling" (still loading content), an orange pulsing dot appears next to the match count \u2014 results will refresh once the page quiets.' },
        { title: "Big pages", body: 'Search is capped at 100k text nodes per run. If a result reads "(partial)" the page exceeded that \u2014 refine the query or use CSS mode for structural search.' },
        { title: "Privacy", body: `Toggle "Incognito" from the Tampermonkey menu to stop persistence for the session. URLs are stored without query strings or hashes so auth tokens don't leak.` }
      ]
    }
  ];
  function build5() {
    modalEl = el("div", { class: "ss-help-modal", hidden: !0, role: "dialog", "aria-modal": "true", "aria-label": "Help" });
    let header = el(
      "div",
      { class: "ss-help-header" },
      el("div", { class: "ss-help-title" }, "Super Search \u2014 Help"),
      el("button", {
        type: "button",
        class: "ss-help-close",
        "aria-label": "Close help",
        onClick: () => hide2()
      }, "\xD7")
    ), body = el("div", { class: "ss-help-body" });
    for (let sec of SECTIONS) {
      if (body.appendChild(el("h3", { class: "ss-help-h" }, sec.h)), sec.rows) {
        let t = el("table", { class: "ss-help-table" });
        for (let [k, v] of sec.rows)
          t.appendChild(el(
            "tr",
            {},
            el("td", { class: "ss-help-key" }, k),
            el("td", { class: "ss-help-val" }, v)
          ));
        body.appendChild(t);
      }
      if (sec.items)
        for (let it of sec.items)
          body.appendChild(el(
            "div",
            { class: "ss-help-item" },
            el("div", { class: "ss-help-item-title" }, it.title),
            el("div", { class: "ss-help-item-body" }, it.body),
            ...it.examples ? [el(
              "ul",
              { class: "ss-help-examples" },
              ...it.examples.map(([code, note]) => el(
                "li",
                {},
                el("code", {}, code),
                el("span", { class: "ss-help-note" }, " \u2014 " + note)
              ))
            )] : []
          ));
    }
    return modalEl.appendChild(header), modalEl.appendChild(body), modalEl.addEventListener("click", (e) => {
      e.target === modalEl && hide2();
    }), modalEl.addEventListener("keydown", (e) => {
      e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), hide2());
    }), modalEl;
  }
  function show2() {
    modalEl && (modalEl.hidden = !1, modalEl.querySelector(".ss-help-close")?.focus());
  }
  function hide2() {
    modalEl && (modalEl.hidden = !0);
  }
  function toggle2() {
    modalEl && (modalEl.hidden ? show2() : hide2());
  }

  // src/logging.js
  var dedupeKeys = /* @__PURE__ */ new Set();
  function sanitiseUrl(url) {
    if (!url) return "";
    try {
      let u = new URL(url);
      return u.origin + u.pathname;
    } catch {
      return String(url);
    }
  }
  function buildLogEntry(match) {
    return {
      ts: new safe.Date().toISOString(),
      kind: match.kind || "text",
      value: match.value,
      before: match.before || "",
      after: match.after || "",
      sourceUrl: sanitiseUrl(match.sourceUrl)
    };
  }
  function key(m) {
    return `${m.value}|${m.before}|${m.after}|${m.sourceUrl}`;
  }
  function logMatches(matches, opts = {}) {
    if (!Array.isArray(matches)) return [];
    let out = [];
    for (let m of matches) {
      let k = key(m);
      dedupeKeys.has(k) || (dedupeKeys.add(k), out.push(buildLogEntry(m)));
    }
    return out;
  }

  // src/privacy.js
  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }
  function isAllowedToPersist(state2, currentUrl) {
    if (state2?.privacy?.incognito) return !1;
    let host2 = hostOf(currentUrl || (typeof location < "u" ? location.href : ""));
    if (!host2) return !0;
    let denylist = state2?.privacy?.denylist || [];
    for (let pattern of denylist)
      if (matchHost(host2, pattern)) return !1;
    return !0;
  }
  function matchHost(host2, pattern) {
    if (!pattern) return !1;
    if (pattern === host2) return !0;
    if (pattern.startsWith(".")) return host2.endsWith(pattern.slice(1));
    if (pattern.startsWith("*.")) {
      let tail = pattern.slice(2);
      return host2 === tail || host2.endsWith("." + tail);
    }
    return !1;
  }

  // src/wiring.js
  var teardown2 = null;
  function buildUI(shadow2, root2) {
    teardown2 && teardown2();
    let unsubs = [], controls = build2(), inputBuilt = build(state_exports), list = build3(), logRegion = build4(), helpModal = build5();
    root2.appendChild(controls), root2.appendChild(inputBuilt.row), root2.appendChild(inputBuilt.summary), root2.appendChild(list), root2.appendChild(logRegion), root2.appendChild(helpModal), installStyles(), install();
    let lastResultFingerprint = null, fingerprintMatches = (ms) => !ms || ms.length === 0 ? "empty" : ms.map((m) => m.id || m.value + "|" + m.before + "|" + m.after).join(","), performSearch = (auto = !1) => {
      let s = get(), result = dispatch({ query: s.query, mode: s.mode, root: document.body, sourceUrl: location.href }), allowedPersist = isAllowedToPersist(s, location.href), patch = {
        matches: result.matches,
        activeIndex: 0,
        inputError: result.error,
        submode: result.submode,
        truncated: !!result.truncated,
        jsErrorMessage: result.jsErrorMessage || null
      };
      result.lastJsResult !== void 0 && (patch.lastJsResult = result.lastJsResult, patch.lastJsResultPresent = !0), s.append && allowedPersist && (patch.historical = mergeHistoricalLocal(s.historical, result.matches));
      let fp = fingerprintMatches(result.matches), sameAsLast = auto && fp === lastResultFingerprint;
      if (lastResultFingerprint = fp, s.log?.enabled && allowedPersist && !sameAsLast) {
        let entries2 = logMatches(result.matches);
        if (entries2.length && (patch.logEntries = [...s.logEntries || [], ...entries2].slice(-1e3), s.log.con && typeof console < "u"))
          for (let e of entries2) console.log("[super-search]", e);
      }
      batch(() => set(patch)), setMatches(result.matches, 0), applyOutlines(result.matches, 0);
    }, liveSearch = debounce(100, () => performSearch(!0)), maybeLive = () => {
      let s = get();
      s.live && s.mode !== "js" && s.query && liveSearch();
    }, navigateTo = (idx) => {
      let s = get();
      s.matches.length !== 0 && (set({ activeIndex: idx }), setActiveOnly(s.matches, idx), applyOutlines(s.matches, idx), scrollToMatch(s.matches[idx]));
    };
    setListeners({
      onInput(v) {
        let next = { query: v };
        v || (next.matches = [], next.activeIndex = 0, next.inputError = null, next.truncated = !1, setMatches([], 0), restore()), set(next), maybeLive();
      },
      onSubmit() {
        let s = get();
        s.matches.length > 0 ? navigateTo(nextIndex(s.activeIndex, s.matches.length)) : performSearch(!1);
      },
      onPrev() {
        let s = get();
        s.matches.length !== 0 && navigateTo(prevIndex(s.activeIndex, s.matches.length));
      },
      onNext() {
        let s = get();
        s.matches.length !== 0 && navigateTo(nextIndex(s.activeIndex, s.matches.length));
      },
      onEscape() {
        hide(), setDeep({ ui: { visible: !1 } });
      }
    }), setListeners2({
      onMode(m) {
        set({ mode: m }), maybeLive();
      },
      onToggle(flag, v) {
        flag === "log" ? setDeep({ log: { enabled: v } }) : flag === "log.win" ? setDeep({ log: { win: v } }) : flag === "log.con" ? setDeep({ log: { con: v } }) : set({ [flag]: v }), flag === "live" && v && maybeLive();
      },
      onHelp() {
        toggle2();
      },
      onCopy() {
        let s = get(), items = s.append ? s.historical : s.matches;
        if (!items || items.length === 0) {
          log.info("Nothing to copy");
          return;
        }
        let lines = items.map((m) => `${m.before || ""}${m.value || ""}${m.after || ""}	${m.sourceUrl || ""}`);
        copyToClipboard(lines.join(`
`));
      },
      onClearAll() {
        let t = safe.dateNow();
        set({
          matches: [],
          activeIndex: 0,
          historical: [],
          logEntries: [],
          clearedAt: t,
          lastJsResult: void 0,
          lastJsResultPresent: !1,
          inputError: null,
          truncated: !1
        });
        try {
          clearAll(t);
        } catch {
        }
        try {
          flushPersist?.();
        } catch {
        }
        setMatches([], 0), restore();
      },
      onDump() {
        let s = get();
        if (!s.lastJsResultPresent) return;
        let r = s.lastJsResult;
        try {
          let w = gm.unsafeWindow || (typeof window < "u" ? window : null);
          w && (w.superSearchResults = r), log.info("Dumped to window.superSearchResults");
        } catch (e) {
          log.error("dump failed: " + e.message);
        }
      }
    }), setListeners3({
      onRowClick(m, i, isHistorical) {
        let here = sanitisedUrl(location.href), there = sanitisedUrl(m.sourceUrl);
        if (there && there !== here) {
          log.info("Match is on a different page: " + there);
          return;
        }
        isHistorical ? scrollToMatch(m) : navigateTo(i);
      },
      onToggleCollapse() {
        let s = get();
        setDeep({ ui: { listCollapsed: !s.ui.listCollapsed } });
      }
    });
    let unsub1 = subscribe((s) => {
      syncFromState(s), syncFromState2(s), syncFromState3(s), syncFromState4(s);
    });
    unsubs.push(unsub1);
    let lastPrunedRef = null, unsub2 = subscribe((s) => {
      if (!s.matches || s.matches.length === 0 || s.matches === lastPrunedRef) return;
      let live = pruneDead(s.matches);
      if (live.length !== s.matches.length) {
        lastPrunedRef = live;
        let newIdx = adjustIndex(s.activeIndex, s.matches.length, live.length);
        set({ matches: live, activeIndex: newIdx }), setMatches(live, newIdx);
      } else
        lastPrunedRef = s.matches;
    });
    return unsubs.push(unsub2), set({}), unsubs.push(on("dom-changed", () => {
      let s = get();
      s.query && s.mode !== "js" && (s.live || s.append) && performSearch(!0);
    })), unsubs.push(on("nav", () => {
      rebind(), setMatches([], 0), restore(), set({ matches: [], activeIndex: 0 }), get().live && get().query && get().mode !== "js" && performSearch(!0);
    })), unsubs.push(on("pagehide", () => {
      flushPersist?.();
    })), unsubs.push(on("dom-unsettled", () => set({ domSettled: !1 }))), unsubs.push(on("dom-settled", () => {
      set({ domSettled: !0 });
      let s = get();
      !s.query || s.mode === "js" || (s.live || s.append) && performSearch(!0);
    })), unsubs.push(on("observer-auto-paused", () => {
      log.warn("Search auto-paused \u2014 page is mutating too rapidly. Will resume after 30s of quiet.");
    })), teardown2 = () => {
      for (let u of unsubs)
        try {
          u();
        } catch {
        }
      teardown2 = null;
    }, { teardown: teardown2 };
  }
  function mergeHistoricalLocal(existing, fresh) {
    let seen = new Set((existing || []).map((m) => m.id)), out = (existing || []).slice();
    for (let m of fresh)
      seen.has(m.id) || (out.push({ ...m, range: null, element: null, sourceUrl: sanitisedUrl(m.sourceUrl || location.href) }), seen.add(m.id));
    return out.length > 1e3 && out.splice(0, out.length - 1e3), out;
  }
  function sanitisedUrl(url) {
    if (!url) return "";
    try {
      let u = new URL(url);
      return u.origin + u.pathname;
    } catch {
      return String(url);
    }
  }
  function copyToClipboard(text) {
    typeof navigator < "u" && navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).catch(() => fallbackCopy(text)) : fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      let ta = document.createElement("textarea");
      ta.value = text, ta.style.position = "fixed", ta.style.opacity = "0", ta.style.pointerEvents = "none", document.documentElement.appendChild(ta), ta.select(), document.execCommand?.("copy"), document.documentElement.removeChild(ta);
    } catch {
    }
  }

  // src/main.js
  function boot() {
    if (checkSentinel().alreadyLoaded) {
      log.warn("already loaded; bailing.");
      return;
    }
    if (!isTopFrame()) {
      log.info("not top frame; bailing.");
      return;
    }
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", boot2, { once: !0 });
      return;
    }
    boot2();
  }
  function boot2() {
    try {
      init();
      let initial2 = readAll();
      hydrate({
        historical: initial2.historical || [],
        logEntries: initial2.logEntries || [],
        ui: { ...get().ui, ...initial2.ui || {} },
        clearedAt: initial2.clearedAt || 0,
        firstRun: !initial2.firstRunDone
      }), setPersistFn((s) => {
        writeHistorical(s.historical || []), writeLog(s.logEntries || []), writeUi(s.ui || {});
      }), listen(KEY_HIST, (v) => mergeHistorical2(v || [])), listen(KEY_LOG, (v) => mergeLog(v || [])), listen(KEY_CLEAR, (v) => {
        let ts = Number(v) || 0;
        if (ts <= (get().clearedAt || 0)) return;
        set({ clearedAt: ts });
        let local = get(), filtered = (local.historical || []).filter((m) => (m.capturedAt || 0) >= ts), filteredLog = (local.logEntries || []).filter((e) => new Date(e.ts).getTime() >= ts);
        set({ historical: filtered, logEntries: filteredLog });
      });
    } catch (e) {
      log.error("storage init failed: " + (e?.message || e));
    }
    let shadow2;
    try {
      shadow2 = mount();
    } catch (e) {
      log.error("panel mount failed: " + (e?.message || e));
      return;
    }
    let rootEl2 = rootEl();
    try {
      buildUI(shadow2, rootEl2);
    } catch (e) {
      log.error("UI wiring failed: " + (e?.message || e));
      return;
    }
    registerShortcut({}, () => {
      toggle(), setDeep({ ui: { visible: isVisible() } });
    }), register({
      onToggle: () => {
        toggle(), setDeep({ ui: { visible: isVisible() } });
      },
      onAbout: () => alert(aboutText()),
      onClearAll: () => {
        let t = safe.dateNow();
        set({
          matches: [],
          historical: [],
          logEntries: [],
          clearedAt: t,
          activeIndex: 0,
          lastJsResult: void 0,
          lastJsResultPresent: !1,
          inputError: null,
          truncated: !1
        });
        try {
          clearAll(t);
        } catch {
        }
        try {
          flushPersist?.();
        } catch {
        }
      },
      onToggleDiagnostics: () => {
        setDiagnostics(!isDiagnostics()), log.info("diagnostics " + (isDiagnostics() ? "on" : "off"));
      },
      onToggleIncognito: () => {
        setDeep({ privacy: { incognito: !get().privacy?.incognito } }), log.info("incognito " + (get().privacy?.incognito ? "on" : "off"));
      }
    });
    try {
      start({
        visibilityGet: () => isVisible(),
        queryGet: () => get().query,
        // Observer runs when Live mode is on OR Append mode is on (because
        // Append + a passive panel is the "scan tabs, collect" workflow).
        liveGet: () => get().live || get().append
      }), start2();
    } catch (e) {
      log.warn("observer/nav start failed: " + e.message);
    }
    if (get().firstRun) {
      try {
        markFirstRunDone();
      } catch {
      }
      show(), setDeep({ ui: { visible: !0 } }), set({ firstRun: !1 });
    } else get().ui?.visible && show();
    log.info("booted v0.1.0");
  }
  boot();
})();
