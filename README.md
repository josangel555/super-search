# Super Search

A Tampermonkey userscript that augments Ctrl+F with regex, CSS selectors, custom JavaScript, timestamp ranges, persistent cross-tab match lists, and logging.

```
+--------------------------------------------+
| [Text][CSS][JS]   [Live][Append][Dedupe]   |
| > search box                          [Go] |
| 3 / 17 matches                             |
| ┌─────────────────────────────────┐  [<>]  |
| │ 1. ...the quick brown FOX jumps │        |
| │ 2. ...over the lazy FOX again   │        |
| └─────────────────────────────────┘        |
+--------------------------------------------+
```

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open `super-search.user.js` from the repo (or build it: `npm install && npm run build`).
3. Tampermonkey will prompt to install. Approve.
4. The panel auto-opens on first run — press `Ctrl+Shift+F` (or use the Tampermonkey menu) to toggle thereafter.

## Search modes

| Mode | Trigger | Examples |
|---|---|---|
| **Text** | Default | `lorem` — case-insensitive, NBSP-aware, zero-width-stripped |
| **Regex** (auto) | Query wrapped in `/…/` | `/error\d+/gi`, `/\bfoo\b/` |
| **Timestamp** (auto) | `HH:MM:SS-HH:MM:SS` or `MM:SS-MM:SS` | `1:00-2:30`, `01:00:00-02:30:00` |
| **CSS selector** | `CSS` button | `div.warning > p`, `a[href*="example.com"]` |
| **JS query** | `JS` button | `[...document.querySelectorAll("a")].map(a => a.href)` |

JS-mode results:
- DOM elements → highlighted on page with pink/green outlines.
- Arrays of strings → listed in panel.
- Single primitives → shown as one match.
- The `Dump` button writes the result to `window.superSearchResults` for further inspection.

## Navigation

- `Enter` (in search box) → next match
- `Shift+Enter` → previous
- `<` / `>` buttons mirror the keyboard
- Click any row in the match list to scroll to it

## Features

- **Live mode**: searches as you type (100ms debounce).
- **Append mode**: accumulates matches across pages and tabs in one cross-tab list.
- **Dedupe**: filters identical matches by `(value, before, after, sourceUrl)`.
- **Cross-tab sync**: open 20 tabs, append-mode-search each, copy the union.
- **Incognito** (Tampermonkey menu): turns off persistence for the session.
- **Per-host denylist** (state-only in v1): skip persistence on sensitive sites.
- **Logging**: optional, with in-panel Win + DevTools Con targets.
- **Diagnostics mode** (Tampermonkey menu): always-on error capture surfaced to console.

## What it survives (defensive design)

- Host page overriding `Array.from`, `MutationObserver`, `JSON`, etc. — we capture frozen refs at script-start.
- Host CSS shouting `* { outline: 5px red !important }` — panel renders inside a **closed shadow root**.
- Host JS stealing `Ctrl+Shift+F` — capture-phase listener + always-available Tampermonkey menu fallback.
- Single-page app navigation — `pushState`/`replaceState` patched, observer re-binds, matches re-run.
- Infinite-scroll loops — observer auto-pauses after 5 triggers in 10s; manual resume.
- Catastrophic regex (`(a+)+b` etc.) — refused syntactically before execution.
- 100k+ text-node pages — bounded text walker with node + time budgets surfaces "partial" warning.
- Cross-tab concurrent appends — content-derived match IDs union without conflict.
- Cross-tab clear races — tombstone timestamp on `Clear All` drops older entries.

## What it does NOT support (v1)

- Shadow DOM (skipped in walker — planned for v2).
- Iframes (skipped via `@noframes` — v2 will postMessage between frame agents).
- Canvas-rendered text (Figma, Google Docs new editor, some PDFs) — out of reach.
- Rich-text editors / `contenteditable` regions (intentionally skipped; rich editors mutate around our ranges).
- Replace-in-page.
- Mobile.

Native browser `Ctrl+F` continues to work for content we skip.

## Build

```bash
npm install
npm run build           # one-shot
npm run build:watch     # rebuilds on file change

npm test                # unit + integration (bun test)
npm run test:e2e        # puppeteer headless Chrome
npm run test:perf       # bench (also runs runner-chrome.mjs for real-Chrome numbers)
```

Bundle is a single self-contained `super-search.user.js` (~67 KB). No external `@require` URLs. No network calls.

## Dev install in Tampermonkey

Use a tiny loader script that `@require`s your local build (requires "Allow access to file URLs" in Tampermonkey settings):

```js
// ==UserScript==
// @name         Super Search (Dev Loader)
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
// @require      file:///absolute/path/to/RegExSearch/super-search.user.js
// ==/UserScript==
```

## Architecture

See [docs/DESIGN.md](docs/DESIGN.md) for the full design, [docs/RISKS.md](docs/RISKS.md) for the wild-west risk register, and [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md), [docs/TEST-PLAN.md](docs/TEST-PLAN.md), [docs/TEST-CASES.md](docs/TEST-CASES.md), [docs/BUILD.md](docs/BUILD.md) for the rest.

## License

Personal use. No warranty.
