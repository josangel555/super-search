# Super Search — Design

This document is the technical companion to [REQUIREMENTS.md](./REQUIREMENTS.md). It describes the architecture, module boundaries, data model, and key algorithms.

---

## 1. Architectural Overview

The mental model is: **pure search → store → subscribers re-render.**

```
                              ┌────────────────┐
   user keystroke ───────────►│ panel.js (UI)  │
                              └───────┬────────┘
                                      │ state.set({query})
                                      ▼
                              ┌────────────────┐         ┌──────────────┐
                              │   state.js     │◄────────│  storage.js  │
                              │  (single store)│         │ (GM_* adapter│
                              └───────┬────────┘         │  + xtab sync)│
                                      │ notify()         └──────┬───────┘
              ┌───────────────────────┼──────────────────────┐  │
              ▼                       ▼                      ▼  │
       ┌──────────────┐      ┌────────────────┐    ┌──────────────────┐
       │ dispatcher.js│      │ matchList view │    │  highlight view  │
       └──────┬───────┘      └────────────────┘    └──────────────────┘
              │
   ┌──────────┼──────────┬──────────────┐
   ▼          ▼          ▼              ▼
 text.js   regex.js  timestamp.js   selector.js / jsquery.js
 (pure)    (pure)     (pure)         (pure)
                                                 ┌──────────────┐
                                                 │ observer.js  │
                                                 │  ─► bus.emit │
                                                 │   ('dom-     │
                                                 │   changed')  │
                                                 └──────────────┘
```

Three architectural patterns in play:

1. **Flux-lite (single store + subscribers)** as the spine.
2. **Strategy** for the four search modes — uniform `(query, root) => Match[]` signature.
3. **Functional core / imperative shell** — strategies are pure; DOM mutation, highlight registration, scroll, and persistence live in the outer layer.

Plus one targeted event-bus seam: the `MutationObserver` emits a single event consumed by the dispatcher, so the observer module doesn't import the search module.

---

## 2. Module Breakdown

```
RegExSearch/
├── docs/
│   ├── REQUIREMENTS.md
│   ├── DESIGN.md              (this file)
│   ├── TEST-PLAN.md
│   └── TEST-CASES.md
├── src/
│   ├── main.js                  // entry point; wiring
│   ├── state.js                 // store + subscribers
│   ├── storage.js               // GM_* adapter + cross-tab sync
│   ├── bus.js                   // tiny event emitter (one seam only)
│   ├── search/
│   │   ├── dispatcher.js        // routes to strategy + auto-detect
│   │   ├── text.js              // plain text
│   │   ├── regex.js             // regex with zero-width guard
│   │   ├── timestamp.js         // timestamp range
│   │   ├── selector.js          // CSS selector
│   │   └── jsquery.js           // eval'd JS query
│   ├── ui/
│   │   ├── panel.js             // window scaffold + CSS
│   │   ├── input.js             // query input subscriber
│   │   ├── controls.js          // mode picker, checkboxes, buttons
│   │   ├── matchList.js         // list rendering subscriber
│   │   ├── logView.js           // log pane subscriber
│   │   └── styles.js            // GM_addStyle string
│   ├── highlight.js             // CSS.highlights + inline outline
│   ├── navigate.js              // next/prev/scrollIntoView
│   ├── observer.js              // debounced MutationObserver
│   └── util/
│       ├── debounce.js
│       ├── treeWalker.js        // text-node iterator with skip-lists
│       ├── escapeRegExp.js
│       └── timeParse.js
├── test/
│   ├── unit/
│   ├── e2e/
│   └── fixtures/
├── build.mjs                    // esbuild
├── super-search.user.js         // build artifact (gitignored except header check)
└── package.json
```

**Dependency direction (strict):**
- `ui/*` and `highlight.js` may read state and import strategies. They never mutate the DOM of the host page outside of well-defined seams (`<panel>` subtree, `CSS.highlights`, element outlines).
- `search/*` is pure: no imports from `ui`, `state`, `storage`. Tests can call them directly.
- `state.js` imports `storage.js`. No other module imports `storage.js`.
- `observer.js` imports `bus.js` only. `dispatcher.js` subscribes to `bus`.

---

## 3. Data Model

```ts
// All hits share this shape, regardless of mode.
type Match = {
  id: string;                   // 'm_' + monotonic counter per search
  kind: 'text' | 'regex' | 'timestamp' | 'selector' | 'js-element' | 'js-string';
  range: Range | null;          // text-based modes
  element: Element | null;      // element-based modes
  value: string;                // matched text
  before: string;               // ≤30 chars of context
  after: string;                // ≤30 chars of context
  sourceUrl: string;            // location.href at match time
  capturedAt: number;           // Date.now()
};

// The store.
type State = {
  // Persisted UI state
  query: string;
  mode: 'text' | 'selector' | 'js';
  live: boolean;
  append: boolean;
  dedupe: boolean;
  log: { enabled: boolean; win: boolean; con: boolean };
  ui: { visible: boolean; width: number; height: number | 'auto'; listCollapsed: boolean };

  // Persisted, cross-tab synced
  historical: Match[];          // FIFO-capped at 1000
  logEntries: LogEntry[];       // FIFO-capped at 1000

  // Runtime (not persisted)
  matches: Match[];             // current-search results
  activeIndex: number;
  inputError: null | 'regex' | 'selector' | 'js';
  lastJsResult: unknown;        // for Dump button
};

type LogEntry = {
  ts: string;                   // ISO timestamp
  kind: Match['kind'];
  value: string;
  before: string;
  after: string;
  sourceUrl: string;
};
```

**Why one normalised `Match` shape:** subscribers (`matchList`, `highlight`, `navigate`) don't branch on mode. Adding XPath mode later is "write `xpath.js`, register strategy, done."

---

## 4. State Management

### 4.1 Store interface

```js
// state.js
const state = { /* initial */ };
const subs = new Set();

export function get()       { return state; }
export function set(patch)  { Object.assign(state, patch); subs.forEach(fn => fn(state)); persist(); }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
```

That's ~15 lines of infrastructure. Subscribers are registered once at boot and own a DOM region; on every notify they re-render their region from current state.

### 4.2 Persistence

`set()` calls a debounced `persist()` (200ms). `persist()`:
1. Splits state into three storage buckets: `ui` (per-tab), `historical` (cross-tab), `log` (cross-tab).
2. Writes each via `storage.write(key, value)`.
3. `storage.js` is the only file that touches `GM_setValue`.

### 4.3 Cross-tab sync

```js
// storage.js
const KEY_HIST = 'ss.historical.v1';
const KEY_LOG  = 'ss.log.v1';
const KEY_UI   = 'ss.ui.v1';

export function write(key, value) {
  GM_setValue(key, JSON.stringify({ v: value, src: TAB_ID }));
}

export function read(key, fallback) {
  const raw = GM_getValue(key, null);
  return raw ? JSON.parse(raw).v : fallback;
}

export function subscribeCrossTab(key, onChange) {
  if (typeof GM_addValueChangeListener !== 'function') return () => {};
  const id = GM_addValueChangeListener(key, (_k, _old, neu, remote) => {
    if (!remote) return;                        // ignore own writes
    onChange(JSON.parse(neu).v);
  });
  return () => GM_removeValueChangeListener(id);
}
```

`state.js` subscribes to changes on `KEY_HIST` and `KEY_LOG` and merges incoming updates into the store, then notifies subscribers. This is the path that lets tab B see tab A's appended matches without user action.

**Conflict resolution:** last-write-wins on the whole `historical` array is dangerous (concurrent appends in two tabs lose one set). Instead, on cross-tab notification we union by `Match.id` (which is content-derived: `hash(value|before|after|sourceUrl|capturedAt)`) so concurrent appends merge cleanly.

### 4.4 Subscriber strategy

One subscriber per DOM region:

| Subscriber | Watches state slice | Re-render behaviour |
|---|---|---|
| `input` view | `query`, `mode`, `inputError` | Replace value, swap textarea vs input |
| `controls` view | `live`, `append`, `dedupe`, `log.*` | Update checkboxes |
| `matchList` view | `matches`, `historical`, `dedupe`, `append` | Re-render list region |
| `highlight` view | `matches`, `activeIndex` | Rebuild `CSS.highlights` set |
| `logView` | `logEntries`, `log.enabled`, `log.win` | Append-only render |

All do full region re-render on notify. Match list will be upgraded to keyed diff if profiling shows > 50ms render.

---

## 5. Search Subsystem

### 5.1 Strategy interface

Every strategy exports a single function:

```js
// signature shared by text/regex/timestamp/selector/jsquery
function run(query: string, root: Element): Match[]
```

- Pure: takes input, returns output. No DOM mutation. No state reads.
- `root` is `document.body` in production; tests pass a fixture root.
- No-throw: invalid input returns `[]`; the caller (dispatcher) handles the "invalid" UI state via a separate validation pass.

### 5.2 Dispatcher

```js
// search/dispatcher.js
import { run as runText }      from './text.js';
import { run as runRegex }     from './regex.js';
import { run as runTimestamp } from './timestamp.js';
import { run as runSelector }  from './selector.js';
import { run as runJS }        from './jsquery.js';

const RX_REGEX     = /^\/(.+)\/([gimsuy]*)$/;
const RX_TIMESTAMP = /^\d{1,2}(:\d{2}){1,2}-\d{1,2}(:\d{2}){1,2}$/;

export function dispatch({ query, mode, root }) {
  if (!query) return { matches: [], error: null };

  try {
    if (mode === 'selector') return { matches: runSelector(query, root), error: null };
    if (mode === 'js')       return { matches: runJS(query, root),       error: null };

    // mode === 'text' — auto-detect sub-mode
    const rx = query.match(RX_REGEX);
    if (rx) return { matches: runRegex({ pattern: rx[1], flags: rx[2] || 'gi' }, root), error: null };
    if (RX_TIMESTAMP.test(query)) return { matches: runTimestamp(query, root), error: null };
    return { matches: runText(query, root), error: null };
  } catch (e) {
    return { matches: [], error: classifyError(e, mode) };
  }
}
```

The dispatcher is the single place auto-detection lives; the strategies don't know about each other.

### 5.3 Text strategy

```js
// search/text.js
const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE']);

export function run(query, root) {
  const needle = normalise(query).toLowerCase();
  if (!needle) return [];

  const matches = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      let p = n.parentElement;
      while (p) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.id === PANEL_ID)        return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while ((node = walker.nextNode())) {
    const haystack = normalise(node.nodeValue).toLowerCase();
    let i = 0;
    while ((i = haystack.indexOf(needle, i)) !== -1) {
      matches.push(buildMatch({ node, start: i, end: i + needle.length, kind: 'text' }));
      i += needle.length;
    }
  }
  return matches;
}

function normalise(s) { return s.replace(/ /g, ' '); }
```

**NBSP handling:** `normalise()` only collapses for matching; ranges are built against the *original* node value at the same indices, which works because ` ` is single-code-unit (same offset).

**`display:none` skipping** is intentionally *not* done in the tree walker — climbing `parentElement` and reading `offsetParent` for every text node is expensive. Instead, we let those matches through and rely on `CSS.highlights` to silently no-op on invisible ranges. Element-mode strategies (selector/JS) do check visibility because there are far fewer candidates.

### 5.4 Regex strategy

Same TreeWalker as text. Key differences:

- Build a single `RegExp(pattern, flags)`; if `g` flag absent, add it (we need to iterate).
- Zero-width guard: after each `exec`, if `result.index === re.lastIndex`, increment `re.lastIndex` by 1. This prevents infinite loops on `/$/g`, `/(?=x)/g`, etc.
- Per-node node-value cap (50,000 chars) — anything larger we skip and log once.

### 5.5 Timestamp strategy

```js
const RANGE = /^(\d{1,2}(?::\d{2}){1,2})-(\d{1,2}(?::\d{2}){1,2})$/;
const TOKEN = /\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g;

export function run(query, root) {
  const m = query.match(RANGE);
  if (!m) return [];
  const lo = toSeconds(m[1]);
  const hi = toSeconds(m[2]);
  if (lo > hi) return [];
  // Walk text nodes, find tokens, filter by [lo, hi].
  // Same walker shape as text.js.
}

function toSeconds(s) {
  const parts = s.split(':').map(Number);
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0]*3600 + parts[1]*60 + parts[2];
}
```

### 5.6 Selector strategy

```js
export function run(query, root) {
  let els;
  try { els = root.querySelectorAll(query); }
  catch (e) { throw new SearchError('selector', e.message); }
  return [...els].map(el => buildElementMatch(el, 'selector'));
}
```

### 5.7 JS strategy

```js
export function run(query, root) {
  let result;
  try { result = (0, eval)(query); }                 // indirect eval, global scope
  catch (e) { throw new SearchError('js', e.message); }

  state.set({ lastJsResult: result });               // for Dump button

  if (result instanceof Element)                     return [buildElementMatch(result, 'js-element')];
  if (result instanceof NodeList || result instanceof HTMLCollection || Array.isArray(result)) {
    const arr = [...result];
    if (arr.length === 0) return [];
    if (arr[0] instanceof Element) return arr.map(el => buildElementMatch(el, 'js-element'));
    return arr.map(v => buildStringMatch(String(v), 'js-string'));
  }
  return [buildStringMatch(String(result), 'js-string')];
}
```

Note: `js.js` is the only strategy that calls `state.set` — for `lastJsResult`. That's an exception to the "strategies are pure" rule, justified because Dump is intrinsically JS-mode-only. If we want strict purity we return `{matches, sideEffect: {lastJsResult: result}}` and let the dispatcher apply it; that's cleaner but probably premature.

---

## 6. Highlighting

### 6.1 Text-based modes

```js
// highlight.js
import { state, subscribe } from './state.js';

const all    = new Highlight();
const active = new Highlight();
CSS.highlights.set('ss-all', all);
CSS.highlights.set('ss-active', active);

subscribe(() => {
  const { matches, activeIndex } = state.get();
  all.clear();
  active.clear();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m.range) continue;                 // element matches don't go here
    (i === activeIndex ? active : all).add(m.range);
  }
});
```

CSS:
```css
::highlight(ss-all)    { background:#DA70D6; color:#000; }
::highlight(ss-active) { background:#32CD32; color:#000; }
```

If `typeof CSS === 'undefined' || !CSS.highlights`, the module installs no-op stubs; navigation still works (scroll only).

### 6.2 Element-based modes

```js
const OUTLINE_DASHED = '2px dashed #FF69B4';
const OUTLINE_SOLID  = '2px solid #32CD32';

function applyOutline(el, style) {
  el.dataset.ssPrevOutline = el.style.outline || '';
  el.dataset.ssPrevShadow  = el.style.boxShadow || '';
  el.style.outline = style;
  if (style === OUTLINE_SOLID) el.style.boxShadow = '0 0 6px #32CD32';
}

function restoreOutline(el) {
  el.style.outline   = el.dataset.ssPrevOutline || '';
  el.style.boxShadow = el.dataset.ssPrevShadow  || '';
  delete el.dataset.ssPrevOutline;
  delete el.dataset.ssPrevShadow;
}
```

Risk: a page may have already set `outline` inline. We save and restore it. We do **not** use a CSS class because host-page CSS could override it.

---

## 7. Navigation

```js
// navigate.js
export function next() {
  const s = state.get();
  if (s.matches.length === 0) return;
  state.set({ activeIndex: (s.activeIndex + 1) % s.matches.length });
  scrollToActive();
}
export function prev() {
  const s = state.get();
  if (s.matches.length === 0) return;
  state.set({ activeIndex: (s.activeIndex - 1 + s.matches.length) % s.matches.length });
  scrollToActive();
}

function scrollToActive() {
  const m = state.get().matches[state.get().activeIndex];
  const target = m.element || m.range?.commonAncestorContainer.parentElement;
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

---

## 8. Observer

```js
// observer.js
import { debounce } from './util/debounce.js';
import * as bus from './bus.js';
import { state } from './state.js';

const tick = debounce(500, () => {
  const s = state.get();
  if (!s.ui.visible)   return;
  if (!s.query)        return;
  if (!s.live)         return;
  bus.emit('dom-changed');
});

const obs = new MutationObserver(tick);
obs.observe(document.body, { childList:true, subtree:true, characterData:true });
```

`dispatcher.js` subscribes:

```js
bus.on('dom-changed', () => {
  const { query, mode } = state.get();
  const { matches, error } = dispatch({ query, mode, root: document.body });
  state.set({ matches, inputError: error, activeIndex: 0 });
});
```

The event-bus seam is justified here because (a) the observer doesn't need to know what a search is, and (b) we want one clear log line in DevTools when this triggers.

---

## 9. UI

### 9.1 CSS isolation

- Host container has `all: initial !important;` plus targeted overrides (position, font, etc.) all marked `!important`.
- All descendant elements have a CSS reset (`#panel * { margin:0; padding:0; border:0; background:transparent; }`).
- The container is appended to `document.body` (not `document.documentElement`) to inherit basic html-level defaults but not body-level styling.

### 9.2 Panel structure

```
<div id="ss-panel">
  <div class="ss-header">
    <div class="ss-mode-picker">[Text][Selector][JS]</div>
    <div class="ss-controls">[Live][Append][Dedupe][Log][Win][Con][Copy][Dump][Clear]</div>
  </div>
  <div class="ss-input-row">
    <textarea class="ss-query"></textarea>
    <button class="ss-go">Go</button>
  </div>
  <div class="ss-summary">3 / 17 matches</div>
  <div class="ss-list-region">
    <div class="ss-list-header">Found Matches [collapse]</div>
    <ul class="ss-list"></ul>
  </div>
  <div class="ss-log-region">
    <ul class="ss-log"></ul>
  </div>
</div>
```

### 9.3 Buttons & their visibility rules

| Button | Visible when |
|---|---|
| `Go` | mode = manual (i.e. live = false) |
| `Dump` | mode = JS AND `lastJsResult` exists |
| `Copy` | matchList is non-empty |
| `Clear` | always |
| `<` `>` nav | always (disabled if matches.length === 0) |

---

## 10. Build Pipeline

```js
// build.mjs
import { build } from 'esbuild';
import fs from 'node:fs';

const header = fs.readFileSync('src/header.txt', 'utf8');

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'super-search.user.js',
  banner: { js: header },
  target: 'chrome110',
  minify: false,                  // Tampermonkey users may inspect
  legalComments: 'inline',
});
```

`src/header.txt` is the `// ==UserScript== … // ==/UserScript==` block. Keeping it separate means version bumps are a one-line edit and not buried in a JS string.

**Dev loop:**
1. `bun run build --watch` writes `super-search.user.js`.
2. Tampermonkey installs that file via `@require file:///abs/path/super-search.user.js` in a tiny shim userscript, so each save reloads on next page load. (Or paste-on-change for simpler setups.)

---

## 11. Error Handling Matrix

| Source | Condition | Behaviour |
|---|---|---|
| Regex parse | `new RegExp` throws | input border → red; matches → []; no console |
| Regex zero-width | `result.index === re.lastIndex` | bump `lastIndex` by 1 |
| Selector parse | `querySelectorAll` throws | input border → red; matches → []; no console |
| JS eval | `eval` throws | input border → red; matches → []; if `log.con`, log error |
| JS result coercion | unexpected type | wrap with `String(result)` as single js-string |
| Storage quota | `GM_setValue` throws | drop FIFO 25% of historical/log, retry once; if still fails, log once |
| Storage parse | `JSON.parse(read())` throws | reset that key to default; log once |
| Cross-tab merge | union by id | duplicates by content-derived id naturally collapse |

---

## 12. Performance Considerations

- **Text-node walk is the hot path.** TreeWalker with skip-list (no `parentElement` climb) → ~30ms on a 100k-node Wikipedia page in informal testing.
- **Highlight rebuild** is O(matches). Using one `Highlight` object for all + one for active means we never have to mutate ranges, only the set membership.
- **Live-mode debounce** at 100ms is the sweet spot — humans don't notice <100ms, and one search per keystroke at >10 keys/sec is wasted.
- **Observer debounce** at 500ms because page mutations (lazy-loaded images, ad reflows) often arrive in bursts.
- **Panel-visibility gate** in the observer is the single biggest CPU win.
- **Storage writes** are debounced 200ms to avoid 60+ writes during a resize drag.

---

## 13. Sync vs Async Decision

**Decision: synchronous search.**

Reasons:
- Real-world: ~5k text nodes / page; search completes in ~30ms; async would add scaffolding for no perceptible win.
- Async forces every consumer + every test to be async too — large blast radius for a speculative gain.
- Strategy interface is `(q, r) => Match[]` — migrating to `AsyncIterable<Match>` later is mechanical because the contract is shared by all four strategies.

Hedge:
- Hard cap of 100k text nodes per search.
- If the cap is hit, surface a "Result may be incomplete" warning in the summary line and log once.
- If this cap ever fires on real user pages, that's the signal to revisit (move strategy to a generator that yields every 1000 nodes via `requestIdleCallback`).

---

## 14. Decisions Log (ADR-lite)

| # | Decision | Date | Why |
|---|---|---|---|
| D-01 | Drop jQuery dependency | 2026-05-12 | 90KB cost per page; all use cases met by `querySelectorAll` / `Element.matches` |
| D-02 | Flux-lite (not signals) | 2026-05-12 | Right size for the app; signals' fine-grained updates not needed at this scale |
| D-03 | Strategies are pure, return `Match[]` | 2026-05-12 | Enables unit tests in happy-dom without DOM mutation; unified consumer logic |
| D-04 | Event bus only at observer→dispatcher seam | 2026-05-12 | Avoids spaghetti while removing a circular import |
| D-05 | Sync search, with 100k-node cap | 2026-05-12 | Async cost not justified at observed page sizes |
| D-06 | Cross-tab sync via `GM_addValueChangeListener` | 2026-05-12 | Required for P1 multi-tab triage use case |
| D-07 | Union-by-id for cross-tab merge | 2026-05-12 | Avoids losing concurrent appends from two tabs |
| D-08 | Inline outline (not class) for element highlights | 2026-05-12 | Host-page CSS can override classes; inline styles win specificity |
| D-09 | No `display:none` filter in text walker | 2026-05-12 | Per-node ancestor walk is too expensive; `CSS.highlights` silently no-ops |
| D-10 | Full re-render per region, no diff | 2026-05-12 | Simpler; revisit only if profiling shows >50ms |

---

## 15. Future (v2+) Considerations

Sketch only, not committed:

- **Shadow DOM / iframes** — walker would need recursive descent through `shadowRoot` and same-origin iframe `contentDocument`. Skip-tag list extends.
- **Async generator strategies** — yield matches in batches, render incrementally.
- **XPath strategy** — `document.evaluate`. Drop-in as a 5th strategy.
- **Replace-in-page** — adds an edit pipeline, dangerous; would need explicit "are you sure" UX.
- **Query history & presets** — separate persistent list keyed by hostname.
- **Export** — JSON/CSV button next to Copy; for P1's collected-list workflow.
