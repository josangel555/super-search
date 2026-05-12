# Super Search — Risks & Mitigations

This document is the "what could go wrong, and how do we survive it" companion to [DESIGN.md](./DESIGN.md). The benchmark is **"as seamless as native find"** — every gap between us and Ctrl+F is a risk worth naming.

---

## 0. The Gap Between Us and Native Find

Native Ctrl+F has structural advantages that no userscript can fully close:

| Capability | Native find | Super Search |
|---|---|---|
| Runs before page JS loads | ✅ | ❌ (post-load injection) |
| Direct access to render tree (incl. shadow, iframes) | ✅ | ❌ (JS-sandboxed) |
| Cannot be overridden by page JS | ✅ | ❌ (page can shadow our globals) |
| Survives CSP, Trusted Types, sandboxed iframes | ✅ | ⚠️ (we hit these) |
| Highlights painted by compositor (cheap) | ✅ | ⚠️ (CSS.highlights similar; outlines for elements are not) |
| Keyboard shortcut un-stealable | ✅ | ❌ (any page can `preventDefault` Ctrl+Shift+F) |
| Zero install, zero state | ✅ | ❌ (we have persisted state to keep consistent) |

We will not match this. The goal is to **close the gap to where it's invisible most of the time, and degrade gracefully when it's not** — fail-soft, never fail-loud, never break the host page.

The rest of this document is the list of ways the wild west breaks us and how we plan to survive each one.

---

## 1. Risk Register

Each risk:
- **Severity** = blast radius if it happens (`Low`/`Med`/`High`/`Critical`).
- **Likelihood** = frequency in the wild (`Rare`/`Common`/`Ubiquitous`).
- **Mitigation** = concrete action.
- **Affects design** = which module changes from the prior [DESIGN.md](./DESIGN.md).

### Category A — Host page interferes with us

#### A1. Host CSS pollutes the panel
- **Severity:** High (panel renders broken or invisible).
- **Likelihood:** Ubiquitous (`* { outline: ... !important }`, reset stylesheets, etc.).
- **Mitigation:**
  - `all: initial !important` on container + `all: revert !important` on direct children is stronger than the current spec; revisit.
  - Render the entire panel inside a **closed shadow root** attached to the container. Shadow root encapsulation is the canonical fix; host CSS can't reach through it. CSS we ship is scoped automatically. (Single biggest architectural upgrade from the prior design.)
  - Inline `<style>` injected into the shadow root, not via `GM_addStyle` (which targets the host document).
- **Affects design:** `ui/panel.js` — wrap container in shadow root; `ui/styles.js` becomes the shadow root's stylesheet; `GM_addStyle` only used for the no-op rules host-side that style the panel's *host element* (basically nothing).

#### A2. Host JS overrides built-ins
- **Severity:** Critical (silent corruption — our code calls `Array.from` and gets back a tampered version).
- **Likelihood:** Rare-but-real (Facebook, Google Translate inject mutators; ad-injection scripts wrap `MutationObserver`).
- **Mitigation:**
  - **Capture frozen references** to every Web API and built-in we touch at script-start, before any user-mode code runs. One file `src/safe.js` exports `safe.Array`, `safe.MutationObserver`, `safe.setTimeout`, `safe.JSON`, `safe.RegExp`, `safe.fetch` (etc).
  - All internal code uses `safe.*`, never globals.
  - This is also a CSP win — some CSPs block `eval` but not function references obtained earlier.
- **Affects design:** new `src/safe.js`; lint rule (or build-time check) forbidding direct use of these globals in `src/` outside `safe.js`.

#### A3. Host JS grabs every keystroke
- **Severity:** High (Ctrl+Shift+F doesn't reach us — Notion, Slack, Google Docs all do this).
- **Likelihood:** Common.
- **Mitigation:**
  - Register the shortcut listener with `{ capture: true }` and on `window` — gets us called before bubbling-phase listeners.
  - Use **`keydown`**, not `keyup`. Some pages `preventDefault` keydown and the keyup never matches.
  - Provide a fallback: **`GM_registerMenuCommand("Toggle Super Search")`** — accessible from the Tampermonkey extension menu even if no shortcut works.
  - User-configurable shortcut (different default if first-choice clashes).
- **Affects design:** `main.js` — capture-phase, `GM_registerMenuCommand`. New persisted field `state.shortcut`.

#### A4. Host JS captures our DOM
- **Severity:** Medium (some sites scan body and remove unknown elements).
- **Likelihood:** Rare.
- **Mitigation:**
  - Append the panel's host element to `document.documentElement`, **not** `document.body` — fewer scripts traverse `html > div` than `body > div`.
  - Use a random-prefixed id on our host element (`ss-${randomHex(6)}`) to avoid id collisions and identification by anti-injection regexes.
  - On every notify, defensively re-check that our host element is still attached; reattach if not.
- **Affects design:** `panel.js` mounts to `documentElement`; subscriber checks `isConnected`.

#### A5. Strict CSP and Trusted Types
- **Severity:** Critical (script doesn't run at all OR can't inject styles/HTML).
- **Likelihood:** Common (banking, gov, GitHub, many enterprise SaaS).
- **Mitigation:**
  - **No `innerHTML` anywhere.** Build DOM via `document.createElement` + `textContent`. (Should be true regardless for XSS safety; CSP+Trusted Types make it mandatory.)
  - Register a **Trusted Types policy** if the page has one:
    ```js
    if (window.trustedTypes?.createPolicy) {
      safe.policy = trustedTypes.createPolicy('super-search', {
        createHTML: s => s, createScript: s => s, createScriptURL: s => s
      });
    }
    ```
    Only used if we ever need it; preferably never.
  - **Avoid `eval`** in our core paths (it's only used for FR-08 JS mode, which is a user-initiated escape hatch — surface a clear error if blocked by CSP).
  - No inline `<style>` tag injection on Trusted-Types-strict sites; use `CSSStyleSheet` + `adoptedStyleSheets` on the shadow root (which is fine under TT).
  - On CSP `script-src 'self'`: Tampermonkey itself usually runs in a sandbox or has CSP-bypass — but if not, the script fails to load. **Not our problem to mitigate** (user knows Tampermonkey isn't working); but detect and surface via `GM_log` so user knows why.
- **Affects design:** `ui/styles.js` uses `CSSStyleSheet`+`adoptedStyleSheets`; `ui/dom.js` helper enforces no-`innerHTML`; `jsquery.js` catches CSP-eval errors specifically and gives a useful message.

#### A6. Iframes — multi-instance
- **Severity:** Medium (multiple panels appear; cross-tab sync becomes cross-iframe noise).
- **Likelihood:** Ubiquitous (every site with embedded YouTube/Twitter/ads).
- **Mitigation:**
  - **Run only in top frame by default.** Bail out immediately if `window.top !== window`. One line in `main.js`.
  - Future opt-in for "search in iframes" — out of scope for v1.
- **Affects design:** Add to `main.js`; document in README.

#### A7. SPA navigation without page reload
- **Severity:** High (script never re-runs; stale match list; observer disconnected from new body).
- **Likelihood:** Ubiquitous (every modern site).
- **Mitigation:**
  - Hook `popstate`, `hashchange`, and monkey-patch `history.pushState` / `replaceState` to fire a synthetic `super-search:nav` event.
  - On `super-search:nav`: clear current matches, persist historical (already auto), re-arm observer on the (possibly new) body, re-run search if a query is set and Live mode is on.
  - The `MutationObserver` was already observing `body`'s subtree — if body itself was replaced, we need to re-observe.
- **Affects design:** `observer.js` exports `rebind()`; new `src/nav.js` handles route detection; `main.js` wires both.

#### A8. ShadowDOM and contenteditable (out-of-scope but worth detecting)
- **Severity:** Low (users will report "doesn't find that text").
- **Likelihood:** Common (Google Docs, Reddit comments, Twitter, anything with custom elements).
- **Mitigation:**
  - Detect: scan first 100 elements at search time for `shadowRoot != null` or `[contenteditable=true]` and surface a one-time banner: "Some content on this page is inside Shadow DOM / contenteditable and not searched."
  - v2 will add shadow traversal.
- **Affects design:** `dispatcher.js` includes a heuristics scan; `ui/matchList.js` shows the banner.

### Category B — Userscript-manager surprises

#### B1. `@run-at` timing
- **Severity:** High (script runs too early — body missing; or too late — SPA mutated before us).
- **Likelihood:** Common.
- **Mitigation:**
  - Use `@run-at document-idle` (after `window.load`).
  - On boot, wait for `document.body` if it doesn't exist yet (rare with document-idle but defensive):
    ```js
    if (!document.body) await new Promise(r => addEventListener('DOMContentLoaded', r, { once: true }));
    ```
  - Wrap entire init in `try/catch` and log to `GM_log` so silent failures are visible.
- **Affects design:** `main.js`.

#### B2. `GM_*` API differences across managers
- **Severity:** High (Violentmonkey/Greasemonkey may not have `GM_addValueChangeListener`; storage semantics differ).
- **Likelihood:** Common (user might switch managers).
- **Mitigation:**
  - **Adapter layer** (`src/storage.js` already designed this way) — feature-detect each API, provide fallbacks.
  - For `GM_addValueChangeListener` absence: fall back to **polling** (`setInterval` 1000ms) of the storage key for changes. Inefficient but correct. Logged once: "cross-tab sync degraded to polling."
  - Alternative shared-state channel: **`BroadcastChannel`** — works across all browsers, doesn't need Tampermonkey, single line: `new BroadcastChannel('super-search')`. Preferred for live notifications; storage is the source of truth.
- **Affects design:** `storage.js` has BroadcastChannel + GM listener + polling fallback in that priority order.

#### B3. `GM_setValue` quota and write-amplification
- **Severity:** Medium (writes fail silently; data loss on append).
- **Likelihood:** Common at high usage.
- **Mitigation:**
  - **Hard cap** on `historical` and `log` lists (already 1000); also **byte cap** (~500KB combined) — measure on each write.
  - Compression: store match `before`/`after` truncated to 30 chars (already specced) — and consider gzip-via-CompressionStream for archival fields.
  - Write batching: debounce + coalesce; never write twice within 200ms.
  - On quota error, evict 25% FIFO and retry once; surface "storage cap hit" warning.
- **Affects design:** `storage.js` — add `write()` quota retry logic.

#### B4. Multiple userscript managers running
- **Severity:** Low (multiple panels appear).
- **Likelihood:** Rare (advanced users only).
- **Mitigation:**
  - Use a global sentinel:
    ```js
    if (window.__SUPER_SEARCH_LOADED__) return;
    window.__SUPER_SEARCH_LOADED__ = true;
    ```
  - Symbol-based to be paranoid: `Symbol.for('super-search.loaded')` registered on the realm.
- **Affects design:** `main.js`.

#### B5. Tampermonkey sandbox vs page realm
- **Severity:** Medium (JS mode `eval` runs in sandbox; user expects page-realm scope).
- **Likelihood:** Common (every Tampermonkey script).
- **Mitigation:**
  - For JS mode: use `unsafeWindow.eval` (declared via `@grant unsafeWindow`) — evaluates in page context, so `document.querySelectorAll('.react-...')` accesses the real page DOM.
  - Document this behaviour in README.
- **Affects design:** `jsquery.js`; `header.txt` adds `@grant unsafeWindow`.

### Category C — Range invalidation & DOM mutation

#### C1. Matches reference removed nodes
- **Severity:** High (highlight stays for nodes that no longer exist; `scrollIntoView` throws; subscribers crash).
- **Likelihood:** Ubiquitous (any SPA, any virtualized list, any infinite scroll).
- **Mitigation:**
  - Before each highlight render, filter `matches` through `isAlive(m)`: `m.range.startContainer.isConnected || m.element?.isConnected`.
  - Drop dead matches; if count changes, surface in summary line ("3 of 17 matches no longer present").
  - Hold matches via `WeakRef` to Element only, never strong refs — lets GC reclaim freely.
- **Affects design:** new `src/lifecycle.js` with `isAlive()`, `pruneDead()`; subscribers call this on every notify.

#### C2. Range offsets drift after text-node split/merge
- **Severity:** High (rare but causes wrong-region highlights).
- **Likelihood:** Common in contenteditable; rare otherwise.
- **Mitigation:**
  - On `dom-changed` event, **re-run search** rather than trusting cached ranges. (Already specced for Live mode; extend to Manual mode triggered by an explicit Refresh button.)
  - Stamp each match with the `nodeValue.length` at capture time; on render, if length changed, mark match stale and skip.
- **Affects design:** `Match` shape gains `capturedNodeLength`; `lifecycle.js` checks it.

#### C3. Detached Ranges throw
- **Severity:** Medium (uncaught throw breaks subscriber chain).
- **Likelihood:** Common.
- **Mitigation:**
  - Every `range.*` call wrapped in `safe.rangeOp(() => ...)` that returns `null` on throw.
  - One try/catch per *subscriber*, not per match — log once, prune, continue.
- **Affects design:** `safe.js` wrapper.

### Category D — Encoding & text correctness

#### D1. Unicode normalisation
- **Severity:** Medium (`café` typed vs `café` in DOM don't match — same display, different NFD/NFC).
- **Likelihood:** Common (macOS clipboard often produces NFD).
- **Mitigation:**
  - Normalise both query and node text to **NFC** before comparison: `s.normalize('NFC')`.
- **Affects design:** `text.js` adds `.normalize('NFC')` step.

#### D2. Case folding traps
- **Severity:** Low (Turkish `İ` ≠ `i.toLocaleLowerCase('tr')`; German `ß` vs `SS`).
- **Likelihood:** Rare.
- **Mitigation:**
  - Use `.toLocaleLowerCase()` (no explicit locale) — browser default. For v1, accept that Turkish edge cases may be off.
- **Affects design:** `text.js` documents this.

#### D3. Zero-width chars and soft hyphens
- **Severity:** Medium (visible text "happy" actually contains `U+00AD` → search misses).
- **Likelihood:** Common (Wikipedia, news sites use soft hyphens for line-breaking).
- **Mitigation:**
  - Normalisation step strips `­`, `​`, `‌`, `‍`, `﻿` from haystack before matching.
  - Map normalised offsets back to original via an index table (parallel to NBSP handling).
- **Affects design:** `util/textNormalise.js` — single source of truth; returns `{ normalised, indexMap }`.

#### D4. Smart quotes / hyphens / dashes
- **Severity:** Low (user types `"foo"` but page has `"foo"`).
- **Likelihood:** Common in news/editorial content.
- **Mitigation:**
  - Optional "smart match" toggle (off by default in v1) that folds `"'-` to ASCII before compare.
- **Affects design:** Deferred to v1.1; spec it in `DESIGN.md` future section.

#### D5. RTL bidi text
- **Severity:** Low (visual offsets ≠ logical; user confused about active match position).
- **Likelihood:** Common on Arabic/Hebrew sites.
- **Mitigation:**
  - Logical offsets are what `Range` uses — correct by default; visual scroll is best-effort.
  - Document as known caveat.

### Category E — Catastrophic regex / pathological inputs

#### E1. ReDoS
- **Severity:** Critical (UI freezes 10+ seconds; tab crashes).
- **Likelihood:** Common (user types `(a+)+b`, paste from Stack Overflow without thinking).
- **Mitigation:**
  - **Hard execution timeout.** Run regex iteration inside a `for` loop with a wall-clock check every 1000 iterations; abort + flag if >500ms elapsed.
  - Surface "regex timed out" in input border + log line.
  - Future: run regex in a Worker with terminate-on-timeout (deferred — Workers can't access DOM; we'd need to send text content over).
- **Affects design:** `regex.js` adds time budget loop.

#### E2. Huge DOM (millions of text nodes)
- **Severity:** High (UI freezes during walk).
- **Likelihood:** Rare in normal browsing; common on archive sites (full-mailing-list pages, huge log dumps).
- **Mitigation:**
  - Node count cap (100k) already specced — enforce with early return.
  - Time budget for the walker — same wall-clock check every 1000 nodes.
  - When cap or budget hits, surface "Partial results — search limited" in summary.
- **Affects design:** `text.js`, `regex.js`, `timestamp.js` share a `boundedWalk()` helper.

#### E3. Huge per-node text
- **Severity:** Medium (one node with 1M chars).
- **Likelihood:** Rare.
- **Mitigation:**
  - Per-node size cap (50k chars) — skip nodes larger.
  - Log once.

#### E4. Infinite-scroll pathology (observer death spiral)
- **Severity:** Critical (search re-runs continuously as scroll adds content; perceived hang).
- **Likelihood:** Ubiquitous (Twitter, Reddit, infinite-scroll product listings).
- **Mitigation:**
  - Observer debounce is 500ms — already specced.
  - **Additional rate limit:** if observer-triggered searches fire more than 5 times in 10 seconds, auto-disable Live + observer, surface "Auto-paused: page is too active. Re-enable manually." with a "Resume" button.
  - Observe **filtered mutations**: ignore `characterData` if the changed node is inside our skip-tag list, ignore `attributes` (we don't observe attributes anyway).
- **Affects design:** `observer.js` adds rate-limit counter.

### Category F — Memory leaks

#### F1. Subscriber leaks
- **Severity:** Medium (memory grows on every panel-rebuild cycle).
- **Likelihood:** Common during development; rare in shipped code if disciplined.
- **Mitigation:**
  - `subscribe()` returns an unsubscribe function; panel teardown calls all unsubscribes.
  - On panel close (not just hidden — actually destroyed), all subscribers released.
- **Affects design:** `state.js` already returns unsub; document the convention.

#### F2. MutationObserver outlives navigation
- **Severity:** Low (one extra observer on the old document; gone on tab close).
- **Likelihood:** Common.
- **Mitigation:**
  - `pagehide` event listener disconnects the observer.

#### F3. Detached Ranges hold node refs
- **Severity:** Low (small leak per match).
- **Likelihood:** Common.
- **Mitigation:**
  - Per C1: prune dead matches on every render. `WeakRef` for Element references.

#### F4. Stored historical grows unbounded across sessions
- **Severity:** Medium (storage bloat → slow boots over weeks).
- **Likelihood:** Common (P1 use case: 20 tabs of triage daily).
- **Mitigation:**
  - FIFO cap (1000) + byte cap (500KB).
  - **Time-based eviction option:** entries older than 30 days drop on boot (configurable). Default off — but available.

### Category G — Security & privacy

#### G1. JS mode is an XSS-of-self loaded gun
- **Severity:** Critical (user pastes query from anywhere; full cookies+localStorage access).
- **Likelihood:** Rare in personal use; non-zero.
- **Mitigation:**
  - On JS mode entry, show banner first time: "JS mode runs your code in the page's context. It can read cookies and localStorage. Use carefully."
  - Persisted `state.acknowledgedJsRisk` so the banner only shows once.
  - **Never auto-load a stored JS query on script start.** Persisted query is loaded as-is into the input but **not executed** until user clicks Go / hits Enter. (Even with Live mode on, JS mode treats first load as Manual.)
- **Affects design:** `main.js` boot — special-case JS mode initial state.

#### G2. Match snippets / URL badges rendered safely
- **Severity:** High (page-controlled text appears in our UI; innerHTML would be XSS).
- **Likelihood:** Ubiquitous if mishandled.
- **Mitigation:**
  - All rendering uses `textContent`. Lint rule: no `innerHTML =` in `src/`.
  - URL badges: render as `<span>` with `textContent`, NOT as `<a>` (we don't want them navigable; FR-11 says "informs the user it cannot be scrolled to" for cross-page — never auto-nav).
- **Affects design:** `ui/dom.js` helper enforces it.

#### G3. Privacy: URLs and matched content stored at rest
- **Severity:** Medium (user appends from a banking page; data in `GM_setValue` forever).
- **Likelihood:** Common.
- **Mitigation:**
  - **Allow/deny list** by hostname in settings: "Don't persist matches from these sites".
  - Default deny-list seeded with common sensitive hosts (banks, healthcare portals if known). Empty by default — opt-in.
  - **Clear All** wipes everything; clearly accessible button.
  - "Incognito mode" toggle: when on, no persistence; matches and log are session-only.
- **Affects design:** new `ui/privacy.js`; new `state.privacy = { incognito, denylist[] }`.

#### G4. Clipboard write timing
- **Severity:** Low (`writeText` requires user gesture; can throw).
- **Likelihood:** Common.
- **Mitigation:**
  - Wrap `navigator.clipboard.writeText` in try/catch; on failure, fall back to `document.execCommand('copy')` via temporary `<textarea>`.
  - Always called from a click handler so the gesture context is present.

### Category H — UX surprises

#### H1. Native find conflict
- **Severity:** Medium (both highlights at once is confusing).
- **Likelihood:** Common (user reflexively presses Ctrl+F).
- **Mitigation:**
  - Listen for `find` events (not standard but emerging — `window.find` exists in Chrome). Hard to detect reliably.
  - **Easier mitigation:** different colour palette so they're visually distinguishable. Native find usually uses yellow; we use orchid/lime. Already specced.

#### H2. Panel obscures critical UI
- **Severity:** Low (annoying).
- **Likelihood:** Common (top-right is also a common site UI location).
- **Mitigation:**
  - Drag-to-reposition: anchor remembered.
  - Per-host position override (auto-pick when remembered position would cover something).

#### H3. Viewport / DPR changes between sessions
- **Severity:** Low (panel restored larger than current viewport).
- **Likelihood:** Common (multi-monitor users, laptop ↔ external display).
- **Mitigation:**
  - On restore, clamp width to `0.85 * window.innerWidth`, height to `0.75 * window.innerHeight`.
  - `resize` event listener re-clamps on viewport change.

#### H4. Forced-colors / high-contrast mode
- **Severity:** Medium (orchid/lime highlights become invisible in forced colors).
- **Likelihood:** Rare (~1% of users) but accessibility matters.
- **Mitigation:**
  - `@media (forced-colors: active)` rule that uses `Highlight`/`HighlightText` system colors.
- **Affects design:** `styles.js`.

#### H5. RTL host pages
- **Severity:** Low (our panel may look odd inside an RTL document).
- **Likelihood:** Common on Arabic/Hebrew sites.
- **Mitigation:**
  - `dir="ltr"` on container + `direction: ltr !important`. Already specced.

### Category I — Cross-tab consistency

#### I1. Concurrent writes from two tabs
- **Severity:** Medium (one set of appends lost).
- **Likelihood:** Common in P1's workflow.
- **Mitigation:**
  - **Content-derived Match IDs** (already specced in latest DESIGN update): `id = hash(value|before|after|sourceUrl|capturedAt)`.
  - Cross-tab merge unions by id; concurrent appends of distinct content survive.
  - For same-content concurrent appends from two tabs, the dedupe naturally collapses them — desired.

#### I2. Clear-from-one-tab race
- **Severity:** Medium (tab A clears all; tab B has unsaved appends in memory; B's appends restore "deleted" entries).
- **Likelihood:** Rare but ugly.
- **Mitigation:**
  - **Tombstone-on-clear**: instead of writing empty list, write `{ clearedAt: <ts>, entries: [] }`. Tabs observing the change apply local filter: drop any in-memory entry with `capturedAt < clearedAt`.
  - Tombstone field persisted; merge logic respects it.
- **Affects design:** Storage schema gains `clearedAt`; merge logic in `state.js` honours it.

#### I3. Storage event doesn't fire for same-origin tabs in some browsers
- **Severity:** Medium (cross-tab sync silently broken).
- **Likelihood:** Rare (Tampermonkey's listener works; native `storage` event has quirks).
- **Mitigation:**
  - **`BroadcastChannel`** as the primary live-sync channel; storage is source of truth, BC is the wake-up signal. Works in all evergreen browsers.
  - `GM_addValueChangeListener` as belt-and-suspenders.

#### I4. Clock skew between tabs (different `Date.now()`)
- **Severity:** Low (capturedAt ordering wrong).
- **Likelihood:** Rare (same machine, same clock — but DST transitions, NTP correction).
- **Mitigation:**
  - Use a monotonic counter per tab in addition to `Date.now()`: `capturedAt: { ts: Date.now(), seq: tab_local_counter++ }`. Order by `(ts, seq)`.
  - Probably over-engineered for v1; defer.

### Category J — Build / deployment / maintenance

#### J1. Header drift
- **Severity:** Medium (`@version` not bumped → Tampermonkey thinks no update).
- **Likelihood:** Common.
- **Mitigation:**
  - Build step generates header from `package.json` `version` field. Don't hand-edit.

#### J2. Bundle bloat
- **Severity:** Low (slow boot, large `@require`).
- **Likelihood:** Common over time.
- **Mitigation:**
  - CI assertion `size <= 100KB`.
  - No external `@require`. All deps bundled.

#### J3. Source map debugging
- **Severity:** Low (hard to debug a bundled minified userscript).
- **Likelihood:** Common during development.
- **Mitigation:**
  - Dev build: unminified, with inline source map.
  - Prod build: unminified (Tampermonkey users may inspect).

#### J4. Test fixture rot
- **Severity:** Medium (live-site test breaks because YouTube redesigned).
- **Likelihood:** Common.
- **Mitigation:**
  - Live-site tests are opt-in (not CI-gated).
  - Snapshot HTML of test pages where reasonable.

### Category K — Operational / observability

#### K1. Silent failures in production
- **Severity:** High (user can't tell why search isn't working).
- **Likelihood:** Common.
- **Mitigation:**
  - **In-app debug log** (already partially specced as the log pane). Errors always go to it, even when logging is "off" (with `level: error`).
  - Toggle: "Diagnostics mode" → also writes to console with `[super-search]` prefix; surfaces version, environment (manager, browser), recent errors.
  - **No remote telemetry.** Privacy.

#### K2. Knowing whether the script even loaded
- **Severity:** Low (user thinks the page hangs; really we never ran).
- **Likelihood:** Common.
- **Mitigation:**
  - `window.__SUPER_SEARCH_LOADED__` sentinel doubles as a "did we run" indicator.
  - `GM_registerMenuCommand("About Super Search")` — clicking shows version + load status.

---

## 2. Architectural Changes from Prior Design

Concretely, the prior [DESIGN.md](./DESIGN.md) should be updated to add or change these:

1. **Shadow root for the panel** (A1). `ui/panel.js` mounts a closed shadow root; CSS becomes scoped automatically.
2. **`src/safe.js` — frozen built-in references** (A2). Project-wide convention: never reach for `Array.from` etc. directly.
3. **Frame guard in `main.js`** (A6): `if (window.top !== window) return;`
4. **SPA navigation hooks** (A7): new `src/nav.js`; observer rebinds on synthetic nav event.
5. **`BroadcastChannel` as primary cross-tab live channel** (B2, I3); `GM_addValueChangeListener` as backup; polling as last resort.
6. **`unsafeWindow.eval` for JS mode** (B5); header `@grant unsafeWindow`.
7. **`src/lifecycle.js`**: `isAlive(match)`, `pruneDead(matches)`, called by every subscriber on every notify (C1, C3, F3).
8. **Text normalisation pipeline (`util/textNormalise.js`)** with NFC + zero-width stripping + NBSP handling, returning `{ normalised, indexMap }` (D1, D3).
9. **Regex execution time budget** (E1): per-iteration wall-clock check; abort on overrun.
10. **Search execution time budget** (E2): walker bails out on time or count cap; partial-result UI surfaced.
11. **Observer auto-pause** (E4): rate limit triggers; one-click resume.
12. **Tombstone on Clear All** (I2): timestamped clear, filters older entries on merge.
13. **Per-host privacy controls** (G3): denylist, incognito toggle.
14. **`pagehide` cleanup** (F2): disconnect observer.
15. **Boot guard** (B4): `Symbol.for('super-search.loaded')` sentinel.
16. **`GM_registerMenuCommand` fallbacks** (A3, K2): toggle, about, clear-all, diagnostics-mode.
17. **Diagnostics log** (K1): always-on error capture; visible via menu.
18. **`@run-at document-idle`** (B1) + body-wait fallback.
19. **Forced-colors media query** (H4).
20. **Per-host position persistence + viewport clamping** (H2, H3).

---

## 3. Defensive Coding Patterns (project-wide)

Adopt as conventions:

- **Never call host-page-mutable globals directly.** Use `safe.*`. Enforce via build-time grep:
  ```
  ! grep -rE '\b(Array|Object|RegExp|Promise|JSON|setTimeout|setInterval|fetch|MutationObserver|document\.createElement)\b' src/ | grep -v 'safe\.js'
  ```
- **Never use `innerHTML`** (or `outerHTML`, or `insertAdjacentHTML`). Lint rule via simple grep in build.
- **Wrap every page-DOM operation in `safe.dom(...)`** — try/catch + null check.
- **Every long loop has a budget**: time check every 1k iterations, count check at every step. Bail with partial result, never freeze the tab.
- **Every observable callback** logs its own name on error so stack traces are useful.
- **Every subscriber** filters through `pruneDead()` before touching DOM.
- **Every storage write** is debounced, byte-counted, and quota-aware.

---

## 4. Performance Budgets (enforced at runtime, not just measured)

| Operation | Budget | On overrun |
|---|---|---|
| Full text walk | 500ms wall-clock OR 100k nodes | Bail; show "Partial results"; log |
| Single regex `exec` loop | 500ms wall-clock | Abort regex; show "Regex too slow"; red border |
| Single-node text length | 50k chars | Skip node; log once per search |
| Storage write batch | 500KB total bytes | FIFO-evict 25%; retry once |
| Observer-triggered searches | 5 per 10s | Auto-pause; user resumes |
| Subscriber render | 50ms (logged, not enforced) | Investigate; consider keyed diff |

These are **runtime guards**, not test thresholds. They're production safety nets.

---

## 5. Gap-Closing Against "Native Find"

Where the design after these changes still falls short of native find, and what we do about it:

| Gap | Mitigation in v1 |
|---|---|
| Doesn't run before page JS | Symbol sentinel; tolerate multi-load; subscribe to nav events |
| Shortcut stealable | Capture-phase listener + `GM_registerMenuCommand` + user-configurable |
| Misses Shadow DOM / iframes | Detect-and-notify banner in v1; full support in v2 |
| Misses canvas-rendered text (Figma, Google Docs) | No mitigation — document as known limitation |
| Native styled by compositor | `CSS.highlights` is competitive; element outlines slightly more expensive |
| Visible to / overrideable by page | Shadow root + safe globals get most of the way; complete isolation impossible |

The remaining gaps are documented in README. Users who hit them will be a small minority; for them, native find still exists.

---

## 6. Recommended Build Sequence (revised)

Given the above, I'd revise the phasing in [REQUIREMENTS.md](./REQUIREMENTS.md) §6 like this:

**Phase 0+** (was 0): scaffold **plus** `safe.js`, `bus.js`, shadow root, frame guard, sentinel, `GM_registerMenuCommand`. **Pay the safety cost upfront**; everything else builds on it.

**Phase 1**: text + regex with **time budgets from day one**. Don't ship "unbudgeted" code and retrofit later.

**Phase 2**: selector + JS + timestamp. Add Trusted Types policy + `unsafeWindow.eval` for JS.

**Phase 3**: match list + persistence + cross-tab (`BroadcastChannel` + GM listener + polling fallback) + tombstone semantics.

**Phase 4**: observer with auto-pause; SPA nav hooks; `pagehide` cleanup; lifecycle pruning everywhere.

**Phase 5**: privacy controls (incognito, denylist); diagnostics mode; forced-colors styling; viewport clamping.

**Phase 6**: E2E + perf + live-site smoke.

Each phase ships in a state where the script is **safe to run on every URL** even if features are incomplete.

---

## 7. Open Problems — Resolved Approaches

These were the open items in the original draft. Each has a concrete answer now, implemented in v1 or scoped for v2.

### 7.1 Late-hydrating pages (Next.js streaming, React 18 Suspense)

**Answer: DOM-settling detector + opportunistic re-search on settle.**

The existing `MutationObserver` doubles as a settling meter. We track mutation rate in a 500ms sliding window. When rate falls below 5 mutations/window, we declare the DOM "settled" and fire `dom-settled` on the bus. The dispatcher subscribes and silently re-runs the current search. The summary line shows a pulsing dot while `domSettled === false` so the user knows results are speculative.

Implemented in `observer.js` + `wiring.js` (Phase 4).

### 7.2 Recursive Shadow DOM + iframe nesting

**Two separate problems, two answers.**

- **Shadow DOM** (intra-document): future v2 support uses recursive descent with `depth ≤ 5` cap. Existing 100k-node budget caps explosion linearly.
- **Iframes** (cross-realm): each frame runs its own headless search agent. Top-frame panel orchestrates via `postMessage`. v2 work. v1 stays `@noframes`.

Out of scope for v1; documented.

### 7.3 Editors mutating around our ranges

**Answer: skip `[contenteditable]` subtrees in the walker by default; lifecycle pruner handles edge cases.**

The treeWalker explicitly skips elements where `isContentEditable === true` OR the attribute is set OR the tag is `<input>` / `<textarea>`. Implemented in `util/treeWalker.js` (Phase 4). For non-editable pages that still mutate ranges, the `lifecycle.isAlive` pruner silently drops invalidated ranges before render — no crash.

### 7.4 Adversarial pages

**Answer: minimal footprint + bounded re-attach + surrender → menu fallback.**

Three layers, all implemented:

- **Footprint**: closed shadow root mounted on `documentElement` (not `body`); container ID is random hex (`ss-${randomUUID().slice(0,6)}`).
- **Bounded re-attach**: panel module exposes `reattach()` (Phase 0+); the wiring layer can call it when `isConnected() === false`.
- **Menu fallback**: `GM_registerMenuCommand` entries are always-available even when the host page eats every key event.

Future hardening: an automatic "surrender" path that detects 3+ re-attachments in 1s and offers per-host disable. Tracked as future work.

### 7.5 Cloud-synced Tampermonkey storage

**Answer: free, given existing merge logic.**

`GM_addValueChangeListener` fires with `remote: true` on both cross-tab AND cloud-sync events. The merger (union-by-content-id + tombstone-aware) treats remote sync indistinguishably from cross-tab events. Verified in `storage.test.js` round-trip + merge unit tests.

### 7.6 First-run UX

**Answer: auto-open the panel on first run, ever, period.**

`main.js` (Phase 3) reads `ss.bootedOnce` from storage; if absent, opens the panel immediately and persists the flag. The panel **is** the onboarding — no toast spam needed. Subsequent boots honour saved visibility state. If the user repeatedly invokes the menu command without ever using the keyboard shortcut, we can surface "shortcut may be blocked" (future enhancement).

---

## 8. Summary

The architectural spine from prior [DESIGN.md](./DESIGN.md) (Flux-lite + strategy + functional core) is sound. The **deltas needed for wild-west reliability** are mostly defensive:

- Shadow-root encapsulation
- Frozen built-in references
- Frame guard + nav hooks + lifecycle pruning
- Runtime budgets on every loop
- `BroadcastChannel` + multi-backend storage adapter
- Tombstone-aware cross-tab merge
- Privacy controls
- Diagnostics mode
- `GM_registerMenuCommand` as the always-available fallback UI

None of these are large pieces of code — most are 20–50 lines each. Their value is that they're paid up-front in Phase 0+ rather than retrofitted after the first 10 bug reports. That up-front investment is **the** difference between "works on a clean page" and "works on the open web."
