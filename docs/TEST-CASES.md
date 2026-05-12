# Super Search — Test Cases

Concrete test cases for every functional requirement. The plan and tooling are in [TEST-PLAN.md](./TEST-PLAN.md); requirements are in [REQUIREMENTS.md](./REQUIREMENTS.md).

**Columns:**
- **ID** — `<level>-<NNN>` where level is `U` (unit), `I` (integration), `E` (E2E), `P` (perf), `M` (manual).
- **FR** — requirement(s) covered.
- **Priority** — `P0` (must pass to ship), `P1` (must pass for feature complete), `P2` (nice to have).

---

## Toggle & shortcut (FR-01)

| ID | Priority | FR | Description |
|---|---|---|---|
| E-001 | P0 | FR-01 | Press `Ctrl+Shift+F` on a blank page; panel becomes visible; query input has focus. |
| E-002 | P0 | FR-01 | Press shortcut again; panel hides; state.ui.visible persisted false. |
| E-003 | P0 | FR-01 | Shortcut fires while focus is in a host-page `<input>` element; panel still toggles. |
| E-004 | P1 | FR-01 | Shortcut fires while focus is in a host-page `<textarea>`; panel still toggles; the textarea's value is unchanged. |
| E-005 | P2 | FR-01, FR-19 | After reload, if `ui.visible` was true, panel reopens automatically. |

---

## Mode selection (FR-02)

| ID | Priority | FR | Description |
|---|---|---|---|
| E-010 | P0 | FR-02 | Default mode is `Text`. |
| E-011 | P0 | FR-02 | Click `Selector` button; input border style updates (single-line); state.mode = 'selector'. |
| E-012 | P0 | FR-02 | Click `JS`; textarea grows to multi-line; state.mode = 'js'. |
| E-013 | P1 | FR-02, FR-19 | Mode survives reload. |

---

## Auto-detection (FR-03)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-020 | P0 | FR-03 | Dispatcher: query `"foo"` in text mode → text strategy. |
| U-021 | P0 | FR-03 | Dispatcher: query `"/foo/"` → regex strategy with flags `gi`. |
| U-022 | P0 | FR-03 | Dispatcher: query `"/foo/im"` → regex strategy with flags `im`. |
| U-023 | P0 | FR-03 | Dispatcher: query `"1:00-2:00"` → timestamp strategy. |
| U-024 | P0 | FR-03 | Dispatcher: query `"01:00:00-02:30:00"` → timestamp strategy. |
| U-025 | P1 | FR-03 | Dispatcher: query `"not/a/regex"` → text strategy (not regex). |
| U-026 | P1 | FR-03 | Dispatcher: query `"/foo"` (unclosed) → text strategy. |
| U-027 | P1 | FR-03 | Dispatcher: query `"1:00 - 2:00"` (with spaces) → text strategy (timestamp regex is strict). |
| U-028 | P2 | FR-03 | Dispatcher: empty query → returns `{matches: [], error: null}`. |

---

## Plain text matching (FR-04)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-040 | P0 | FR-04 | `run("lorem", basic.html root)` returns 17 matches (per `basic.expected.json`). |
| U-041 | P0 | FR-04 | Case-insensitive: `run("LOREM", ...)` returns same 17 matches. |
| U-042 | P0 | FR-04 | NBSP: query `"Media Advisor"` matches a node containing `"Media Advisor"`. |
| U-043 | P0 | FR-04 | Overlapping: `run("aa", "aaaa")` returns 2 matches at offsets 0 and 2 (non-overlapping iteration). |
| U-044 | P1 | FR-04 | `<script>` content is skipped. |
| U-045 | P1 | FR-04 | `<style>` content is skipped. |
| U-046 | P1 | FR-04 | The panel's own subtree (id=`ss-panel`) is skipped. |
| U-047 | P2 | FR-04 | Unicode: matches `"café"` for query `"café"` (NFC normalisation, no extra logic). |
| U-048 | P2 | FR-04 | `display:none` regions are *not* filtered out (regression test for decision D-09). |
| I-049 | P0 | FR-04, FR-09 | Integration: run text search → `CSS.highlights.get('ss-all').size === 17`. |
| E-050 | P0 | FR-04 | E2E: type `"lorem"` on `basic.html`; summary shows `1 / 17`. |

---

## Regex matching (FR-05)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-060 | P0 | FR-05 | `/lorem/i` matches 17 (same as plain). |
| U-061 | P0 | FR-05 | `/lorem/g` matches 0 (case-sensitive). |
| U-062 | P0 | FR-05 | `/\b\w{5}\b/g` returns expected count from fixture. |
| U-063 | P0 | FR-05 | `/$/g` does not infinite-loop; terminates within 1s; returns zero-width matches. |
| U-064 | P0 | FR-05 | `/(?=x)/g` does not infinite-loop. |
| U-065 | P0 | FR-05 | Invalid regex `/[/` → `dispatch()` returns `{matches: [], error: 'regex'}`. |
| U-066 | P1 | FR-05 | If user types `/foo/` (no `g`), strategy adds `g` for iteration. |
| U-067 | P2 | FR-05 | Node-value cap: per-node value >50k chars returns 0 matches from that node and logs once. |
| E-068 | P0 | FR-05 | E2E: type `/lorem/i`; matches highlighted in orchid. |
| E-069 | P0 | FR-05 | E2E: type `/[/`; input border turns red. |

---

## Timestamp range (FR-06)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-080 | P0 | FR-06 | `"1:00-2:00"` on `transcript.html` matches `1:30` and `2:00`; misses `0:45`, `2:30`. |
| U-081 | P0 | FR-06 | `"01:00:00-02:30:00"` matches `01:01:25`. |
| U-082 | P1 | FR-06 | Range inclusive at both bounds. |
| U-083 | P1 | FR-06 | `"2:00-1:00"` (inverted) returns 0 matches (graceful). |
| U-084 | P2 | FR-06 | Standalone tokens only — `1:301` in text doesn't match. |
| U-085 | P2 | FR-06 | Token immediately after a digit (e.g. `score 21:30`) does match (word boundary lets through). |
| E-086 | P0 | FR-06 | E2E: type `"1:00-2:00"` on transcript fixture; summary `1 / 2`. |

---

## Selector mode (FR-07)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-100 | P0 | FR-07 | `"a[href*='example.com']"` returns expected element list. |
| U-101 | P0 | FR-07 | Invalid `"div..foo"` throws; dispatcher returns `error: 'selector'`. |
| U-102 | P1 | FR-07 | Empty result → `matches: []`. |
| E-103 | P0 | FR-07, FR-09 | E2E: switch to Selector mode, query `"p"`; paragraphs get dashed hot-pink outline. |
| E-104 | P0 | FR-07 | E2E: query `"p:nth-child(2)"`; first navigation lands the active outline on the right element. |

---

## JS mode (FR-08)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-120 | P0 | FR-08 | Return value `document.body` → 1 element match (`js-element`). |
| U-121 | P0 | FR-08 | Return value `document.querySelectorAll('p')` → N element matches. |
| U-122 | P0 | FR-08 | Return value `[...document.querySelectorAll('a')].map(a=>a.href)` → N string matches (`js-string`). |
| U-123 | P0 | FR-08 | Return value `"hello"` → 1 string match with value `"hello"`. |
| U-124 | P0 | FR-08 | Return value `42` → 1 string match with value `"42"`. |
| U-125 | P0 | FR-08 | Throwing query → `error: 'js'`; matches []. |
| U-126 | P1 | FR-08 | `state.lastJsResult` is set after a successful run. |
| E-127 | P0 | FR-08 | E2E: textarea grows to multi-line when JS mode selected. |
| E-128 | P0 | FR-08 | E2E: after a successful JS run, Dump button appears; clicking sets `window.superSearchResults`. |
| E-129 | P1 | FR-08 | E2E: Dump button is hidden in non-JS modes. |

---

## Highlighting (FR-09)

| ID | Priority | FR | Description |
|---|---|---|---|
| I-140 | P0 | FR-09 | After text search, `CSS.highlights.get('ss-all').size > 0`. |
| I-141 | P0 | FR-09 | After navigation, `CSS.highlights.get('ss-active').size === 1`. |
| I-142 | P0 | FR-09 | Selector mode: applied outlines have the expected style; `dataset.ssPrevOutline` is set. |
| I-143 | P0 | FR-09 | After clearing search, all `dataset.ssPrev*` are removed and inline styles restored. |
| U-144 | P1 | FR-09 | `CSS.highlights` undefined → module installs no-op stub; no crash. |
| E-145 | P1 | FR-09 | E2E: visually inspect orchid + lime colours (snapshot test on canvas-rendered patch). |

---

## Navigation (FR-10)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-160 | P0 | FR-10 | `next()` advances index by 1; wraps at end. |
| U-161 | P0 | FR-10 | `prev()` decrements; wraps at start. |
| U-162 | P1 | FR-10 | `next()` with 0 matches is a no-op (no crash). |
| E-163 | P0 | FR-10 | E2E: Enter advances; Shift+Enter recedes. |
| E-164 | P0 | FR-10 | E2E: `<` and `>` buttons mirror keyboard. |
| E-165 | P0 | FR-10 | E2E: counter shows `3 / 17` after pressing Enter twice from start. |
| E-166 | P1 | FR-10 | E2E: `scrollIntoView` brings the active match into viewport (assert via element bounding-box). |
| E-167 | P2 | FR-10 | E2E: wrapping — Enter at last match returns to first. |

---

## Match list (FR-11)

| ID | Priority | FR | Description |
|---|---|---|---|
| E-180 | P0 | FR-11 | List renders one row per match. |
| E-181 | P0 | FR-11 | Row shows context (≤30 chars before/after) and value. |
| E-182 | P1 | FR-11 | Element row shows `<p#para1.lorem>` shape with inner-text snippet. |
| E-183 | P1 | FR-11 | Click on row scrolls to and activates that match. |
| E-184 | P1 | FR-11 | Cross-page rows show URL badge. |
| E-185 | P1 | FR-11 | Click on cross-page row shows inline note "Not on this page"; does not navigate. |
| E-186 | P2 | FR-11 | Collapse toggle hides the list region. |

---

## Append mode (FR-12)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-200 | P0 | FR-12 | Append union by `Match.id` preserves no duplicates. |
| E-201 | P0 | FR-12 | E2E: Append on; search "foo" (5 matches); search "bar" (3 matches); list shows 8. |
| E-202 | P0 | FR-12 | E2E: Append off; search "foo"; search "bar"; list shows 3. |
| E-203 | P0 | FR-12 | E2E cross-page: append on; navigate fixture A → B; second search; list contains both A and B. |
| E-204 | P1 | FR-12, FR-19 | Append state survives reload. |

---

## Dedupe (FR-13)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-220 | P0 | FR-13 | Dedupe key = `(value, before, after, sourceUrl)`. |
| E-221 | P0 | FR-13 | E2E: Append on, dedupe on, run same search twice; list count unchanged. |
| E-222 | P1 | FR-13 | E2E: Dedupe off after dedupe on — original duplicates re-appear. |

---

## Copy (FR-14)

| ID | Priority | FR | Description |
|---|---|---|---|
| E-240 | P0 | FR-14 | Click Copy; `navigator.clipboard.readText()` returns list contents. |
| E-241 | P1 | FR-14 | Copied text has no `1.`/`2.` prefixes. |
| E-242 | P2 | FR-14 | Cross-page rows include URL on each line, tab-separated. |

---

## Cross-tab sync (FR-15)

| ID | Priority | FR | Description |
|---|---|---|---|
| I-260 | P0 | FR-15 | Storage listener fires on remote change; local merge unions by id. |
| E-261 | P0 | FR-15 | E2E two-tab: tab A append 5; tab B panel reflects 5 within 500ms. |
| E-262 | P0 | FR-15 | E2E two-tab: both tabs append concurrently; final state in both tabs has union of both contributions (no loss). |
| E-263 | P1 | FR-15 | E2E: `activeIndex` is local — A and B can have different selected matches. |

---

## Live mode (FR-16)

| ID | Priority | FR | Description |
|---|---|---|---|
| E-280 | P0 | FR-16 | Live on: typing fires a search after 100ms quiet. |
| E-281 | P0 | FR-16 | Live off: typing does nothing; clicking Go runs search. |
| E-282 | P1 | FR-16 | Rapid typing debounces — search runs once after 100ms after last keystroke. |
| E-283 | P1 | FR-16 | `Go` button visible only when Live off. |

---

## DOM observation (FR-17)

| ID | Priority | FR | Description |
|---|---|---|---|
| I-300 | P0 | FR-17 | Observer subscribes to body; debounced 500ms. |
| I-301 | P0 | FR-17 | Observer no-ops when `ui.visible === false`. |
| I-302 | P0 | FR-17 | Observer no-ops when `live === false`. |
| I-303 | P0 | FR-17 | Observer no-ops when `query === ''`. |
| E-304 | P0 | FR-17 | E2E: on `dynamic.html`, search "added"; wait 1s for `setTimeout` insertion; new match appears within 700ms. |
| P-305 | P1 | FR-17, NFR-01 | Perf: mutate body 100 times in 1s while panel hidden; observer callback CPU ≤ 5ms total. |

---

## Logging (FR-18)

| ID | Priority | FR | Description |
|---|---|---|---|
| U-320 | P0 | FR-18 | `log.enabled = false` → no entries written. |
| U-321 | P0 | FR-18 | Same `(value, ctx, url)` not logged twice in same session. |
| E-322 | P0 | FR-18 | E2E: enable Log + Win; run search; entries appear in log pane. |
| E-323 | P0 | FR-18 | E2E: enable Log + Con; entries appear in DevTools console (capture via Puppeteer `page.on('console')`). |
| E-324 | P1 | FR-18 | E2E: Log persists across reload. |
| E-325 | P1 | FR-18 | E2E: Clear All wipes matches + historical + log. |

---

## UI state persistence (FR-19)

| ID | Priority | FR | Description |
|---|---|---|---|
| I-340 | P0 | FR-19 | Each persisted field round-trips through `GM_setValue`/`GM_getValue`. |
| E-341 | P0 | FR-19 | E2E: change every persisted field, reload, every field is restored. |
| I-342 | P1 | FR-19 | Persist is debounced 200ms (no thrash on resize). |
| I-343 | P2 | FR-19 | Schema-version mismatch resets that key to default; doesn't crash. |

---

## Window behaviour (FR-20)

| ID | Priority | FR | Description |
|---|---|---|---|
| E-360 | P1 | FR-20 | Drag resize handle; new size persists. |
| E-361 | P1 | FR-20 | Panel positioned at top:20px right:10px regardless of host page scroll. |
| E-362 | P2 | FR-20 | `hostile-css.html` (host CSS sets `* { outline: 5px red !important }`) doesn't break panel appearance. |

---

## Performance (NFR-01, NFR-02)

| ID | Priority | NFR | Description |
|---|---|---|---|
| P-400 | P0 | NFR-01 | `large.html` (50k text nodes) + query "lorem": p95 search ≤ 500ms. |
| P-401 | P0 | NFR-01 | Same fixture: keystroke→render p95 ≤ 200ms in Live mode. |
| P-402 | P1 | NFR-01 | Observer hidden: CPU ≤ 0.1% over 10s sample. |
| P-403 | P1 | NFR-02 | Storage FIFO: insert 1001 entries; assert length 1000 and oldest evicted. |
| P-404 | P1 | NFR-04 | `super-search.user.js` size ≤ 100KB ungzipped. |

---

## Resilience (multiple)

| ID | Priority | Coverage | Description |
|---|---|---|---|
| E-500 | P0 | FR-05, NFR-05 | Invalid regex doesn't throw to host page console. |
| E-501 | P0 | FR-07, NFR-05 | Invalid selector doesn't throw. |
| E-502 | P0 | FR-08, NFR-05 | Throwing JS query doesn't throw. |
| E-503 | P1 | NFR-05 | After Clear All, no DOM artifacts remain (assert via `document.querySelectorAll('[data-ss-prev-outline]').length === 0`). |
| E-504 | P1 | NFR-05 | Hostile CSS: host page CSS targeting `* { all: revert }` doesn't break panel. |

---

## Manual smoke tests (live sites)

| ID | Priority | Coverage | Description |
|---|---|---|---|
| M-700 | P0 | All FRs | Wikipedia article — open panel; text search "the"; navigate; regex search; selector mode `p`; close. |
| M-701 | P0 | FR-06, FR-17 | YouTube with transcript open — timestamp range search; let video autoplay 1 min; observer doesn't loop. |
| M-702 | P1 | FR-12, FR-15 | GitHub PR list → click into PR; append mode on; both pages contribute to historical. |
| M-703 | P1 | FR-08 | MDN — JS mode `[...document.querySelectorAll('code')].map(c=>c.textContent)`; Dump; inspect `window.superSearchResults`. |
| M-704 | P2 | FR-17, NFR-01 | Twitter/X feed scroll — observer keeps up; panel CPU low when hidden. |

---

## Summary by priority

| Priority | Count |
|---|---|
| P0 | 60 |
| P1 | 47 |
| P2 | 17 |

Target: all P0 green before declaring "feature complete"; P1 green before tagging a release; P2 tracked as backlog.
