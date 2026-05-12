# Super Search — Build & Distribution

How ~20 source files in `src/` become one `super-search.user.js` that Tampermonkey installs.

---

## 1. The Output Shape

Tampermonkey installs **one file** with a header comment block. Everything else — modules, helpers, dependencies — must live inside that one file.

```
// ==UserScript==
// @name         Super Search
// @namespace    https://github.com/jos/RegExSearch
// @version      0.1.0
// @description  ...
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==
(() => {
  // ~5,000 lines of bundled IIFE
})();
```

That's it. No external `@require`, no remote dependencies, no source map references that point off-disk.

---

## 2. Tool Choice: esbuild

| Tool | Verdict | Why |
|---|---|---|
| **esbuild** | ✅ | Fast (<100ms full build), native ESM, banner support, IIFE output, watch mode |
| Rollup | ❌ | Slower; configuration overhead for marginal gains |
| Webpack | ❌ | Major overkill; slow startup |
| Vite | ❌ | Designed for dev servers; wrong shape |
| tsc + concat | ❌ | Lose module isolation; manual dependency ordering |
| No bundler | ❌ | Defeats the modular architecture |

We don't need TypeScript for v1. esbuild can compile TS later without changes; the choice is open.

---

## 3. The Build Script

```js
// build.mjs
import { build, context } from 'esbuild';
import { readFileSync } from 'node:fs';
import { argv } from 'node:process';
import pkg from './package.json' with { type: 'json' };

const watch = argv.includes('--watch');
const dev   = argv.includes('--dev') || watch;

const header = readFileSync('src/header.txt', 'utf8')
  .replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{DESCRIPTION}}', pkg.description);

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'super-search.user.js',
  banner: { js: header },
  target: 'chrome110',
  minify: false,                  // never; Tampermonkey users may inspect
  legalComments: 'inline',
  logLevel: 'info',
  define: {
    '__SS_VERSION__': JSON.stringify(pkg.version),
    '__SS_DEV__':     JSON.stringify(dev),
  },
  sourcemap: dev ? 'inline' : false,
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log('watching…');
} else {
  await build(opts);
  // Size check — fail the build if over budget.
  const { size } = await import('node:fs').then(fs => fs.promises.stat('super-search.user.js'));
  const KB = (size / 1024).toFixed(1);
  console.log(`built: ${KB} KB`);
  if (size > 100 * 1024) {
    console.error('FAIL: bundle exceeds 100KB budget');
    process.exit(1);
  }
}
```

That's the whole bundler. ~40 lines.

---

## 4. The Header Template

`src/header.txt` (single source of truth — never hand-edit `super-search.user.js`):

```
// ==UserScript==
// @name         Super Search
// @namespace    https://github.com/jos/RegExSearch
// @version      {{VERSION}}
// @description  {{DESCRIPTION}}
// @author       Jos
// @match        *://*/*
// @icon         https://www.svgrepo.com/show/508005/search-alt-2.svg
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// @inject-into  content
// ==/UserScript==
```

Notable directives:

- **`@noframes`** — Tampermonkey skips iframe injection. Single biggest reliability win; eliminates 90% of multi-instance risk. (v2's "search iframes" feature will remove this and add explicit cross-frame messaging.)
- **`@grant unsafeWindow`** — required for JS mode to `eval` in page realm.
- **`@grant GM_log`** — diagnostics target that doesn't need DOM.
- **`@run-at document-idle`** — after `window.load`. Combine with body-wait fallback in `main.js`.
- **`@inject-into content`** — Tampermonkey-specific; runs in the sandboxed content world. Reduces collision risk with page globals.

Version comes from `package.json` so `npm version patch` is the release flow.

---

## 5. The IIFE Wrapper and Module Boundaries

esbuild's `format: 'iife'` produces:

```js
(() => {
  // module 1
  var safe = (() => { /* exports */ })();
  // module 2
  var state = (() => { /* exports */ })();
  // ...
  // entry
  main();
})();
```

Modules execute in dependency order — esbuild walks the import graph and emits modules before their consumers. Side-effect-only imports work:

```js
// src/main.js
import './safe.js';        // executes first; populates frozen built-ins
import './sentinel.js';    // bails out if already loaded
import './frameguard.js';  // bails if not top frame
import { boot } from './boot.js';

boot();
```

The order of side-effect imports matters. Three patterns:

1. **Defensive globals must be captured first** — `safe.js` before anything else, so when later modules call `safe.MutationObserver`, the references are pristine.
2. **Hard exits must come early** — `sentinel.js` and `frameguard.js` return before we start subscribing to anything. (With `@noframes` the frame guard is belt-and-suspenders, but cheap.)
3. **Everything else** imports `safe` and reads from it.

esbuild does **not** hoist these — IIFE format preserves source order.

---

## 6. Safe-Globals Pattern Across the Bundle

```js
// src/safe.js
// Capture references BEFORE any other module body runs.
// Anything imported here is frozen at module-load time.

const _Array          = Array;
const _Object         = Object;
const _RegExp         = RegExp;
const _JSON           = JSON;
const _Promise        = Promise;
const _Map            = Map;
const _Set            = Set;
const _WeakRef        = typeof WeakRef !== 'undefined' ? WeakRef : null;
const _setTimeout     = setTimeout;
const _clearTimeout   = clearTimeout;
const _MutationObs    = MutationObserver;
const _BroadcastChan  = typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null;
const _CSSHighlights  = (typeof CSS !== 'undefined' && CSS.highlights) ? CSS.highlights : null;
const _HighlightCtor  = typeof Highlight !== 'undefined' ? Highlight : null;
const _crypto         = crypto;
const _docElement     = document.documentElement;
const _docCreateEl    = document.createElement.bind(document);

// Bound methods (so callers don't accidentally pass the wrong `this`):
const arrayFrom       = _Array.from.bind(_Array);
const arrayIsArray    = _Array.isArray.bind(_Array);
const objectAssign    = _Object.assign.bind(_Object);
const objectKeys      = _Object.keys.bind(_Object);
const objectFreeze    = _Object.freeze.bind(_Object);
const jsonParse       = _JSON.parse.bind(_JSON);
const jsonStringify   = _JSON.stringify.bind(_JSON);

export const safe = objectFreeze({
  Array: _Array, Object: _Object, RegExp: _RegExp, JSON: _JSON,
  Promise: _Promise, Map: _Map, Set: _Set, WeakRef: _WeakRef,
  setTimeout: _setTimeout, clearTimeout: _clearTimeout,
  MutationObserver: _MutationObs, BroadcastChannel: _BroadcastChan,
  cssHighlights: _CSSHighlights, Highlight: _HighlightCtor,
  crypto: _crypto, docElement: _docElement, createEl: _docCreateEl,
  arrayFrom, arrayIsArray, objectAssign, objectKeys, jsonParse, jsonStringify,
});
```

`safe.js` is **the only file** allowed to reference these globals directly. A grep-based build check enforces this:

```js
// build.mjs additions
const DISALLOWED = /\b(Array|Object|RegExp|JSON|Promise|Map|Set|setTimeout|setInterval|MutationObserver|BroadcastChannel|crypto)\b/g;
// (run after build, scan src/ excluding safe.js)
```

Not a hard fail in v1; a warning that surfaces drift.

---

## 7. The Sentinel and Frame Guards

```js
// src/sentinel.js
const KEY = Symbol.for('super-search.loaded');
if (globalThis[KEY]) {
  // Another instance already loaded (different userscript manager,
  // accidental double-inject, etc). Exit cleanly.
  throw new Error('SS_ALREADY_LOADED');     // caught in main.js
}
globalThis[KEY] = { version: '__SS_VERSION__', bootedAt: Date.now() };

// src/frameguard.js — defence-in-depth for @noframes
if (window.top !== window) {
  throw new Error('SS_IN_FRAME');
}
```

`main.js` catches both and exits silently. `GM_log` records the reason if diagnostics mode is enabled.

---

## 8. Dev Loop

Three setups, depending on speed-vs-fidelity needed.

### 8.1 Hot-reload via local `@require` (recommended)

A one-time loader script in Tampermonkey:

```js
// loader-dev.user.js — paste once into Tampermonkey
// ==UserScript==
// @name         Super Search (Dev Loader)
// @namespace    https://github.com/jos/RegExSearch
// @version      1.0.0
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// @require      file:///Users/jos/Documents/workspaces/scripts/RegExSearch/super-search.user.js
// ==/UserScript==
```

Requires Tampermonkey's **"Allow access to file URLs"** setting (Chrome extension settings → Tampermonkey → Details → ON).

Workflow:
1. `npm run build:watch` — esbuild watches `src/` and rebuilds on save.
2. Reload any browser tab — Tampermonkey re-`require`s the local file fresh.
3. Test, iterate.

### 8.2 Paste-on-change

For environments where file-URL access is blocked:

```bash
npm run build && cat super-search.user.js | pbcopy
```

Open Tampermonkey dashboard → script → paste. Same flow, slower iteration.

### 8.3 Direct DevTools injection

For one-off probes without Tampermonkey at all:

```bash
npm run build:dev   # builds with __SS_DEV__ = true; inline sourcemap
```

Paste contents into DevTools console on a test page. Stubs `GM_*` from `test/setup-gm.js` injected first. Useful for very tight debug loops.

---

## 9. The Full Project Layout

```
RegExSearch/
├── package.json
├── build.mjs                       // ~40 lines
├── super-search.user.js            // build artifact (gitignored)
├── docs/
│   ├── REQUIREMENTS.md
│   ├── DESIGN.md
│   ├── RISKS.md
│   ├── BUILD.md                    (this file)
│   ├── TEST-PLAN.md
│   └── TEST-CASES.md
├── src/
│   ├── header.txt                  // userscript header template
│   ├── main.js                     // entry point
│   ├── safe.js                     // frozen built-in references
│   ├── sentinel.js                 // singleton guard
│   ├── frameguard.js               // top-frame guard
│   ├── boot.js                     // ordered initialisation
│   ├── state.js                    // single store + subscribers
│   ├── storage.js                  // GM_* + BroadcastChannel + polling
│   ├── bus.js                      // event seam (observer → dispatcher)
│   ├── nav.js                      // SPA navigation detection
│   ├── lifecycle.js                // isAlive, pruneDead
│   ├── observer.js                 // MutationObserver + auto-pause
│   ├── highlight.js                // CSS.highlights + outlines
│   ├── navigate.js                 // next/prev/scrollIntoView
│   ├── search/
│   │   ├── dispatcher.js
│   │   ├── text.js
│   │   ├── regex.js
│   │   ├── timestamp.js
│   │   ├── selector.js
│   │   └── jsquery.js
│   ├── ui/
│   │   ├── panel.js                // shadow root + container
│   │   ├── styles.js               // CSSStyleSheet (scoped to shadow)
│   │   ├── input.js
│   │   ├── controls.js
│   │   ├── matchList.js
│   │   ├── logView.js
│   │   └── menu.js                 // GM_registerMenuCommand entries
│   └── util/
│       ├── debounce.js
│       ├── textNormalise.js        // NFC + NBSP + zero-width
│       ├── timeParse.js
│       └── escapeRegExp.js
└── test/
    ├── unit/                       // *.test.js, bun test
    ├── integration/
    ├── e2e/                        // puppeteer
    ├── perf/
    ├── manual/
    │   └── SMOKE.md
    └── fixtures/                   // *.html
```

---

## 10. The Boot Sequence

`src/main.js`:

```js
import './safe.js';
import './sentinel.js';     // throws if already loaded
import './frameguard.js';   // throws if not top frame
import { boot } from './boot.js';

try {
  boot();
} catch (e) {
  if (e.message === 'SS_ALREADY_LOADED' || e.message === 'SS_IN_FRAME') return;
  GM_log('Super Search: boot failed: ' + e.message + '\n' + e.stack);
}
```

`src/boot.js`:

```js
import { safe } from './safe.js';
import * as storage from './storage.js';
import * as state from './state.js';
import * as nav from './nav.js';
import * as observer from './observer.js';
import * as panel from './ui/panel.js';
import * as menu from './ui/menu.js';

export async function boot() {
  if (!document.body) await waitForBody();

  state.hydrate(storage.readAll());
  storage.subscribeCrossTab(remote => state.mergeRemote(remote));

  panel.mount();         // shadow root + DOM
  menu.register();       // GM_registerMenuCommand entries
  observer.start();
  nav.start();

  if (state.firstRun()) panel.show({ firstRunBanner: true });
}

function waitForBody() {
  return new safe.Promise(r => addEventListener('DOMContentLoaded', r, { once: true }));
}
```

Ordering rationale:
1. Storage hydration before subscribers so they render with correct initial state.
2. Cross-tab listener attached before panel mount so we don't miss any remote events.
3. Panel mounts before observer/nav start so subscribers exist when those modules fire.
4. First-run check is the last thing — by now everything is wired and showing the panel is safe.

---

## 11. Release Flow

```bash
# 1. Bump version
npm version patch       # patches src/header.txt via package.json read

# 2. Build
npm run build           # asserts size budget; writes super-search.user.js

# 3. Run tests
npm run test:all        # unit + integration + e2e

# 4. Manual smoke
# Run the checklist in test/manual/SMOKE.md against 5 real sites

# 5. Tag and publish
git tag v0.1.0
git push --tags

# 6. Distribute
# Option A: commit super-search.user.js to a release branch; users install via raw URL
# Option B: GitHub Releases; users install via the URL of the asset
# Option C: Greasy Fork upload (manual)
```

Distribution via `@updateURL` pointing at a stable raw URL means Tampermonkey auto-checks for updates daily. Single source of truth.

---

## 12. Why This Bundling Strategy is Right

- **One file out, all source modular.** Architectural benefits without distribution cost.
- **No external runtime dependencies.** No `@require https://…` — supply chain risk and offline failure mode eliminated.
- **Fast iteration.** esbuild rebuilds in <100ms; file-URL `@require` reloads on every page navigation.
- **Defensive primitives ship in the bundle, not retrofitted.** `safe.js`, sentinel, frame guard, shadow root all live in the same IIFE and execute in deterministic order.
- **Sourcemap on demand.** Dev builds have inline maps for debugging; prod builds don't (Tampermonkey users may want to read the source as-is).
- **Versioning is automated.** `package.json` → header → release tag, all from one number.

---

## 13. What This Doesn't Solve

- **Userscript-manager-specific quirks** (Greasemonkey 4.x has different `GM_*` semantics) → handled in `storage.js` adapter, not in the bundler.
- **Tampermonkey's content-script vs. dedicated-script worlds** (`@inject-into content` vs `page` vs `auto`) → the directive picks; runtime detection via `unsafeWindow` if needed.
- **CSP restrictions on inline styles** → `adoptedStyleSheets` (see [DESIGN.md](./DESIGN.md) §9.1 and [RISKS.md](./RISKS.md) §A5), not a bundler concern.
