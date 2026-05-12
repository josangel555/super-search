# Super Search — Requirements

## 1. Overview

Super Search is a Tampermonkey userscript that augments the browser's native "find in page" with regex, CSS selector, custom JavaScript, and timestamp-range search modes. Findings are highlighted in place, listed in a side panel, optionally accumulated across pages and tabs, and optionally logged.

### Primary goal
Let a power user search any page with patterns the browser's built-in Ctrl+F cannot express, and collect those findings into one persistent list across many tabs.

### Non-goals
- Replacing developer tools (no full-page DOM inspector, no breakpoints).
- Working as an extension (we stay inside Tampermonkey's GM_* APIs).
- Cross-browser parity beyond Chromium-based browsers in v1.

---

## 2. Personas & Use Cases

### P1 — Researcher
Has 20 tabs open from a single browsing session, wants to scan each for the same pattern and collect all hits into one list to copy into notes.

### P2 — Developer
Investigating a bug; wants to search the rendered DOM with a CSS selector or run an ad-hoc JS query, then jump to each match.

### P3 — Long-form reader
Watching a video or reading a transcript with timestamps; wants to find all references in a `01:00:00–02:30:00` range.

### P4 — Log scrubber
Looking at a CI build log or chat archive; wants `/ERROR\s+\d+/i` and a running log of every hit across paginated views.

---

## 3. Functional Requirements

Each requirement has an ID (`FR-NN`) used by [TEST-CASES.md](./TEST-CASES.md).

### FR-01 — Toggle visibility
- Pressing `Ctrl+Shift+F` toggles the tool window.
- When opened, focus lands in the query input.
- The shortcut must work over `input`/`textarea` elements on the host page.

### FR-02 — Search modes (selectable)
Four user-selectable modes: `Text`, `Selector`, `JS`. (Regex and Timestamp are auto-detected sub-modes of `Text`.) The current mode is persisted.

### FR-03 — Text mode + auto-detection
In Text mode, the dispatcher inspects the query:
- Matches `^/(.+)/([gimsuy]*)$` → **Regex** sub-mode.
- Matches `^\d{1,2}(:\d{2}){1,2}-\d{1,2}(:\d{2}){1,2}$` → **Timestamp** sub-mode.
- Otherwise → **Plain text** sub-mode.

### FR-04 — Plain text matching
- Case-insensitive.
- Non-breaking spaces (` `) treated as regular spaces for matching, but match offsets returned are in the original text node.
- Whole-document scan via `TreeWalker(SHOW_TEXT)`.
- Skip `<script>`, `<style>`, `<noscript>`, `<template>`, the Super Search panel itself, and `display:none` subtrees.

### FR-05 — Regex matching
- Full JavaScript regex semantics.
- Default flags inferred: if user types `/foo/`, the dispatcher adds `gi` if no `g` flag present.
- Zero-width matches (e.g. `/$/`, `/(?=x)/`) advance the search index by 1 to prevent infinite loops.
- Invalid regex syntax: input box receives a red border and the search halts; no exception bubbles to the console.

### FR-06 — Timestamp range
- Query form `START-END` where each side is `MM:SS` or `HH:MM:SS`.
- The scanner finds standalone timestamp tokens in text (`\b(\d{1,2}:)?\d{1,2}:\d{2}\b`).
- A token matches iff its parsed seconds are within `[startSec, endSec]` inclusive.

### FR-07 — Selector mode
- Treats the query as a CSS selector, evaluated with `document.querySelectorAll`.
- Matches are returned as `Element[]`.
- Invalid selector → red border, no exception.

### FR-08 — JS mode
- Single textarea (resizable, multi-line) replaces the input.
- Query is `eval`'d in page context.
- Result classification:
  - `Element` → wrap in a 1-element array, treat as element matches.
  - `NodeList` / `HTMLCollection` / `Array<Element>` → element matches.
  - `Array<string>` → string matches (no on-page highlight, listed in panel).
  - Anything else → coerced to string, listed as single result.
- Execution errors → red border, message in the log pane if logging enabled.
- A `Dump` button (only visible in JS mode after a successful run) writes `window.superSearchResults = lastResult`.

### FR-09 — Highlighting
- Text/regex/timestamp matches: orchid background via `CSS.highlights` (highlight name `ss-all`).
- Active text match: lime-green background via `CSS.highlights` (highlight name `ss-active`).
- Element matches (selector / JS element): dashed hot-pink `outline` applied inline, original outline saved.
- Active element match: solid lime-green `outline` + `box-shadow` applied inline.
- All inline style mutations must be reversible on clear.
- If `CSS.highlights` is unavailable, text-mode highlights are silently skipped (navigation still works).

### FR-10 — Navigation
- `Enter` in the query input → next match.
- `Shift+Enter` → previous.
- UI buttons `<` and `>` mirror keyboard.
- Counter shows `current / total` (e.g. `3 / 17`); shows `-` when no matches.
- Navigation scrolls the match into view (`scrollIntoView({behavior:'smooth', block:'center'})`).
- Navigation wraps at both ends.

### FR-11 — Match list (panel section)
- Collapsible.
- Each row shows: serial number, context before (≤30 chars), the matched value, context after (≤30 chars).
- Element matches show `<tag#id.class>` plus a snippet of the element's inner text.
- Cross-page matches show a small URL badge.
- Click on a current-page row → scroll to match and activate.
- Click on a different-page row → highlight the row in the panel only; brief inline note "Not on this page".

### FR-12 — Append mode
- Checkbox; persisted.
- When ON: new search results are unioned into the `historical` collection rather than replacing it.
- When OFF: each new search replaces the displayed list (historical remains untouched for next time append is turned on).
- `historical` is shared across all tabs running Super Search (see FR-15).

### FR-13 — Dedupe
- Checkbox; persisted.
- When ON, the rendered list filters out duplicate rows. Default uniqueness key: `(matchedText, contextBefore, contextAfter, sourceUrl)`.
- Dedupe is display-only; the underlying `historical` collection is preserved unfiltered.

### FR-14 — Copy
- `Copy` button copies the currently-rendered list to the clipboard via `navigator.clipboard.writeText`.
- Serial numbers are omitted. Format per row: `{contextBefore}{match}{contextAfter}\t{sourceUrl}\n`.

### FR-15 — Cross-tab live sync
- All tabs running Super Search share one `historical` collection via `GM_setValue` + `GM_addValueChangeListener`.
- Use case (P1): tab A search appends 5 matches; tab B (already open) panel reflects the new 5 within ~500ms without user action in tab B.
- The active match index in each tab is local; the list is global.

### FR-16 — Live mode
- Checkbox; persisted; default ON.
- When ON: typing in the query input triggers a search after 100ms of inactivity.
- When OFF (Manual): search runs only on `Enter` or `Go` button.

### FR-17 — DOM observation
- A single `MutationObserver` watches `document.body` (childList + subtree + characterData).
- Callback is debounced 500ms.
- Callback no-ops unless: (a) the panel is visible, (b) a non-empty query is set, (c) Live mode is ON.
- When triggered, it re-runs the current search using the current query and mode.

### FR-18 — Logging
- `Log` checkbox toggles the logging subsystem.
- Two independently-toggleable targets: `Win` (in-panel log pane) and `Con` (browser DevTools console).
- Each entry: ISO timestamp, mode, matched value, context, sourceUrl.
- Duplicate suppression: same `(value, context, url)` is not re-logged in the same session.
- Log is persisted via `GM_setValue` and reloaded across page navigations.
- `Clear All` clears: matches, historical, log.

### FR-19 — UI state persistence
The following fields survive page reload and are restored on init:
- query, mode
- live, append, dedupe
- log.enabled, log.win, log.con
- ui.visible, ui.width, ui.height, ui.listCollapsed

### FR-20 — Window behaviour
- Position: fixed `top:20px; right:10px`.
- Resizable by dragging bottom-right corner; dimensions persisted.
- Compact layout: small buttons, minimal padding.
- CSS isolation: `all: initial` on container; explicit overrides everywhere.

---

## 4. Non-Functional Requirements

### NFR-01 — Performance
- Search of a 50,000-text-node page completes in ≤ 500ms p95 on a modern laptop.
- Live mode keystroke→render latency ≤ 200ms p95 on the same page.
- Idle CPU when panel hidden: ≤ 0.1% (observer is gated on visibility).

### NFR-02 — Memory
- Persisted `historical` collection is FIFO-capped at 1,000 entries.
- Log is FIFO-capped at 1,000 entries.
- On cap reach, eviction warning logged once per session.

### NFR-03 — Browser support
- Chrome / Edge / Brave / Arc (Chromium ≥ 110).
- Firefox / Safari are best-effort; `CSS.highlights` fallback (no text highlight, navigation still works) is acceptable on missing-feature browsers.

### NFR-04 — Footprint
- Bundled `.user.js` ≤ 100 KB ungzipped.
- No external runtime dependencies (no `@require https://...`).
- No network calls from the userscript at runtime.

### NFR-05 — Host-page safety
- Must not break host pages: no DOM wrapping for highlights, no global variables other than `window.superSearchResults` (only on user-initiated Dump).
- Must not capture key events not addressed to its input.
- Must not throw uncaught exceptions into the host page's console.

### NFR-06 — Privacy
- All data stays in `GM_setValue` (per-userscript local storage); nothing transmitted off-device.
- URL is stored alongside matches; logs include URLs. (Acknowledged; documented in README.)

### NFR-07 — Security
- JS mode runs in the host page's JS context (this is the feature, but state explicitly): the tool is intended for personal use; do not share or run on untrusted pages without awareness.

### NFR-08 — Build & install
- Single source-of-truth: `src/main.js` bundles to `super-search.user.js` via esbuild.
- Local dev: bundle is watched and Tampermonkey reloads on save (via `@require file://...` workflow or direct paste).

---

## 5. Out of Scope (v1)

- Shadow DOM traversal.
- Iframe content (cross-origin or same-origin).
- `contenteditable` regions.
- Match-list export to JSON/CSV/HAR.
- Search history (separate from match list).
- Saved query presets.
- Replace-in-page.
- Localisation.
- Mobile browsers.

---

## 6. Resolved Open Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | Sync vs async search | **Sync** with node-count cap. Async deferred to v2; strategy interface allows mechanical migration. |
| 2 | Where does auto-detection live | **In the dispatcher**, not per-strategy. Detection is one regex per sub-mode; centralised is easier to read and test. |
| 3 | Subscriber render strategy | **Full re-render per region** initially. Add keyed diff for match list only if its render time exceeds 50ms. |
| 4 | Cross-tab sync | **Yes — required.** Shared `historical` via `GM_addValueChangeListener`. Use case is multi-tab triage. |

---

## 7. Glossary

- **Match** — a normalised hit, regardless of source mode. Carries either a `Range` (for text-based hits) or an `Element` (for element-based hits), plus context and source URL.
- **Historical** — the cross-tab, cross-page accumulated `Match[]` collection, persisted under one `GM_setValue` key.
- **Sub-mode** — text-mode auto-detected variants: `plain`, `regex`, `timestamp`.
- **Active match** — the currently-navigated match, rendered with the lime-green emphasis style.
