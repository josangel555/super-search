# Test Coverage — what's tested, what's not

Snapshot of test inventory at end of build session. Companion to [TEST-PLAN.md](./TEST-PLAN.md) (which described what we *intended* to test) and [TEST-CASES.md](./TEST-CASES.md) (which enumerated cases by FR). This doc is the **honest reconciliation** between plan and reality.

## Numbers

| Layer | Files | Tests | Status |
|---|---|---|---|
| Unit (bun + happy-dom) | 20 | 105 | all green |
| Integration (bun + happy-dom) | 2 | 5 | all green |
| E2E (puppeteer headless Chrome) | 1 runner | 10 scenarios | all green |
| Perf (happy-dom) | 1 runner | informational | runs |
| Perf (real Chrome) | 1 runner | informational | runs |
| Manual smoke | SMOKE.md | 8 sections | **not yet executed** |

`bun test` reports 120 pass / 22 files — that includes a couple of multi-`it` groupings I'm counting as separate tests above.

---

## What we test

### Layer 1 — Pure module unit tests (bun + happy-dom)

Solid coverage. These tests are **independent of UI** and represent the bulk of confidence in correctness.

#### `safe.test.js` (5 tests)
- Object.isFrozen(safe) → true.
- safe.Array / Object / JSON / RegExp / Date are the original built-ins.
- **survives host page Array tampering**: temporarily overrides `Array.from`; `safe.arrayFrom` keeps working.
- bound JSON helpers stringify/parse correctly.
- timing primitives exist and `dateNow()` returns a positive number.

#### `sentinel.test.js` (2 tests)
- First `checkSentinel()` → `alreadyLoaded: false`.
- Second → `alreadyLoaded: true` with version info.

#### `dom.test.js` (5 tests)
- `el(tag, props, children)` builds elements with class/text.
- Nested arrays of children flatten.
- `onClick` prop attaches a listener that fires.
- `clear()` removes all children.
- `setText` uses textContent (no HTML parsing — XSS safety verified).

#### `textNormalise.test.js` (6 tests)
- ASCII passes through unchanged.
- NBSP → regular space, index map preserved.
- Zero-width space dropped, index map shifts correctly.
- Soft hyphen dropped.
- normaliseQuery applies same transforms.
- Empty input handled.

#### `treeWalker` — tested indirectly via `walker-skip.test.js` (3 tests)
- `[contenteditable=true]` subtrees skipped.
- `<noscript>` skipped.
- `<template>` skipped.

#### `matchId` — implicitly tested via `search-text.test.js` ("content-derived ids are stable").

#### `dispatcher.test.js` (10 tests)
- detectTextSubmode: plain / regex (`/foo/`, `/foo/i`, `/\d+/gi`) / timestamp (MM:SS and HH:MM:SS) / strings-with-slashes NOT regex / strict timestamp (no spaces) / empty → 'empty'.
- dispatch: empty query → empty matches; text query finds matches; regex query finds matches; invalid regex returns `error: 'regex'` without throwing.

#### `search-text.test.js` (9 tests)
- Case-insensitive matching.
- NBSP-aware (`Media Advisor` matches DOM with NBSP).
- Zero-width-space-aware.
- Skips `<script>` content.
- Skips `<style>` content.
- Overlapping (non-overlapping iteration of `aa` in `aaaa`).
- Empty query returns no matches.
- Context snippets built around matches.
- Identical content produces identical IDs (for cross-tab dedupe).

#### `search-regex.test.js` (11 tests)
- `/pattern/flags` parsed correctly.
- Adds `g` flag if missing.
- Invalid regex throws `RegexParseError`.
- Finds matches with `/\d+/`.
- Case-insensitive flag.
- `/$/g` doesn't infinite-loop.
- Lookahead `/(?=x)/g` doesn't infinite-loop.
- **`(a+)+b` family refused syntactically** (ReDoS guard).
- `(.+)+` family refused.
- Benign patterns allowed.
- Alternation without nested quantifiers allowed.

#### `search-timestamp.test.js` (5 tests)
- Tokens inside range matched.
- Inclusive at bounds.
- `HH:MM:SS` form works.
- Inverted range → empty.
- Malformed input → empty.

#### `search-selector.test.js` (4 tests)
- Tag selector finds elements.
- Attribute selector (`a[href*="..."]`) works.
- Invalid throws `SelectorError`.
- No-match returns empty.

#### `search-jsquery.test.js` (6 tests)
- Returning a single DOM Element → one js-element match.
- Returning a NodeList → element matches.
- Returning an Array<string> → string matches.
- Returning a primitive (42) → single string match.
- Throwing code → `JsError`.
- `lastJsResult` captured.

#### `timeParse.test.js` (6 tests)
- `MM:SS` and `HH:MM:SS` to seconds.
- Bad input → NaN.
- parseRange for both formats.
- Malformed → null.

#### `elementHighlight.test.js` (3 tests)
- Dashed pink on non-active, solid green on active.
- Saves and restores prior inline outline style.
- `isOutlined` reflects state.

#### `navigate.test.js` (3 tests)
- `nextIndex` wraps at end.
- `prevIndex` wraps at start.
- Empty list handled.

#### `lifecycle.test.js` (8 tests)
- Range with connected node → alive.
- Detached start node → dead.
- Node value length changed → dead (catches text mutations).
- Connected element → alive.
- Detached element → dead.
- js-string always alive.
- `pruneDead` removes dead matches.
- `adjustIndex` clamps when list shrinks.

#### `state.test.js` (6 tests)
- Initial state has expected defaults.
- `set` notifies subscribers.
- Unsubscribe stops further calls.
- `setDeep` shallow-merges nested objects.
- `hydrate` merges into initial state.
- Persist function gets called after debounce.

#### `bus.test.js` (4 tests)
- Handlers fire in registration order.
- No-handler emit doesn't throw.
- Unsubscribe stops further calls.
- Handler exceptions don't break sibling handlers.

#### `storage.test.js` (7 tests)
- write/read round-trip.
- Historical capped at MAX_ENTRIES.
- Missing keys return sane defaults.
- `mergeHistorical` unions by id.
- Respects `clearedAt` tombstone.
- Caps at MAX_ENTRIES preserving newest.
- Handles undefined inputs gracefully.

#### `privacy.test.js` (7 tests)
- `hostOf` extracts hostname.
- `hostOf` returns empty for non-URL.
- Empty privacy → allowed.
- Incognito → blocked.
- Exact hostname denylist.
- `.suffix` pattern denylist.
- `*.wildcard` pattern denylist.

#### `logging.test.js` (3 tests)
- `buildLogEntry` produces ISO timestamp + match fields.
- Session-deduped by `(value, before, after, sourceUrl)`.
- Different URLs treated as separate entries.

### Layer 2 — Integration tests (bun + happy-dom)

Smaller — just enough to verify wiring works.

#### `boot.test.js` (2 tests)
- main.js executes without throwing, mounts a `div[id^="ss-"]` on documentElement, applies `position: fixed`.
- panel.show / .hide / .toggle change visibility state.

#### `searchPipeline.test.js` (3 tests)
- State hydrates with empty defaults on boot.
- `dispatch()` against a fixture body returns expected match count.
- Selector mode works end-to-end through the dispatcher.

### Layer 3 — E2E (Puppeteer + headless Chrome)

10 scenarios in `test/e2e/runner.mjs`:

1. Panel mounts as a `div[id^="ss-"]` on documentElement.
2. CSS.highlights API is reachable.
3. CSS highlight names register without throwing.
4. `Ctrl+Shift+F` does not break the host page (page remains queryable after the shortcut).
5. Hostile-CSS fixture (`* { outline: ... !important }`) doesn't crash bundle load.
6. Dynamic page mutation (`setTimeout` injecting nodes) doesn't throw the observer.
7. GM_* storage shim round-trips through `GM_setValue` / `GM_getValue`.
8. `ss.bootedOnce` first-run flag is set after boot.
9. Transcript fixture loads cleanly.
10. NBSP fixture loads cleanly.

### Layer 4 — Perf (informational, not asserted)

- `test/perf/runner.mjs` — happy-dom, slow (DOM construction in happy-dom is the bottleneck, not our code).
- `test/perf/runner-chrome.mjs` — real Chrome via puppeteer. Last run: 50k text nodes in 31–42 ms p95; 120k nodes bails at 100k budget in 84 ms.

### Layer 5 — Manual smoke (`test/manual/SMOKE.md`)

8-section checklist for Wikipedia / YouTube / GitHub / MDN / hostile-CSS / cross-tab / first-run / privacy / diagnostics. **Not yet executed.**

---

## What we do NOT test

This is the more important part of the doc — it's where the bugs are hiding.

### Critical gaps (would affect users)

#### 1. **The actual UI interaction loop**
- Typing into the textarea triggering a search through state → dispatcher → highlight.
- Clicking the mode-picker buttons changing state.mode.
- Live-mode debounce behaviour (typing fast vs. slow).
- Enter/Shift+Enter cycling navigation.
- Click on a match-list row scrolling to the match.

We test the underlying modules thoroughly. We never test that they're wired correctly end-to-end through the closed shadow root. The E2E tests only verify that the script loads without breaking the page.

**Why we don't test this:** the panel UI lives inside a closed shadow root and can't be reached from the test context. To fix this we'd need either a `__SS_DEV__`-gated debug hook exposing the shadow root, or a Puppeteer CDP-level mode that pierces shadow boundaries (possible via `--enable-features=...` flags).

#### 2. **Cross-tab sync behaviour**
- Tab A appends, Tab B sees the new entries.
- Two tabs append concurrently — union-by-id correctly merges both.
- Tab A clears, Tab B's offline appends respect the tombstone.
- BroadcastChannel + GM_addValueChangeListener interaction.

We test the **merge function** (`mergeHistorical`) which is the meat. We never test the **plumbing** that calls it across real tabs.

**Why:** requires either two Puppeteer pages on the same origin with a shared localStorage backing (file:// URLs don't share localStorage), or a real HTTP fixture server.

#### 3. **MutationObserver-driven re-search**
- DOM mutation → observer fires → search re-runs → matches update.
- Observer auto-pause after 5 triggers / 10 s.
- DOM-settling detector toggling `domSettled`.
- `dom-settled` event silently re-running the current search.

We test that the observer doesn't *throw* on dynamic pages (E2E #6). We don't verify the cascade.

**Why:** would require shadow-root-reachable test hooks (same blocker as #1).

#### 4. **SPA navigation**
- `history.pushState` patched → emits `nav` event.
- Observer rebinds on nav.
- Current matches cleared, search re-runs.
- `popstate` and `hashchange` handlers.

Not tested at all.

#### 5. **Highlight rendering**
- `CSS.highlights.get('ss-all').size` matches the number of matches.
- The "active" range is in `ss-active`, the rest in `ss-all`.
- Highlights clear correctly when matches drop.

We verify the **highlight names register** (E2E #2, #3). We don't verify the contents.

**Why:** for the same shadow-root reason — we can't get the state module's `matches` array from the test context, so we can't assert "the N matches state knows about are the N ranges in the Highlight set."

#### 6. **Scroll-into-view on navigation**
Never tested.

#### 7. **Copy to clipboard**
Never tested. `navigator.clipboard.writeText` requires a user gesture; testing this needs a Puppeteer interaction sequence we haven't built.

#### 8. **Dump to `window.superSearchResults`**
Never tested.

#### 9. **`GM_registerMenuCommand` handlers**
The menu entries are registered but the handlers (toggle / about / clear-all / diagnostics / incognito) aren't fired in any test. In a real browser they're invoked by the user clicking a menu item — no E2E equivalent.

#### 10. **First-run auto-open**
We test that the flag persists (E2E #8). We don't test that the panel actually opens visibly on first run.

### Important but non-critical gaps

#### 11. **Performance regression detection**
The perf runner outputs numbers but doesn't assert them. A 10× regression would slip through CI.

#### 12. **Bundle-size regression**
`build.mjs` logs the size and warns if >100KB but doesn't fail the build.

#### 13. **The `safe.js` defence in production**
We test that `safe.arrayFrom` survives `Array.from = ...` tampering. We don't test that the rest of the bundle actually goes through `safe.*` consistently. Earlier in the build I mentioned adding a grep-based lint rule for this. Never added.

#### 14. **CSS isolation in real browsers**
The hostile-CSS E2E test only checks that the script loads. It doesn't verify the panel renders correctly inside that adversarial environment. Visual regression testing (screenshots) isn't set up.

#### 15. **Forced-colors / high-contrast mode**
CSS exists for `@media (forced-colors: active)`. Untested.

### Quality-of-test gaps (tests that are weaker than they look)

#### 16. **happy-dom is not a browser**
Many "unit" tests run against happy-dom, which has known divergences from real DOM:
- `TreeWalker` with `SHOW_TEXT` returns nothing (we worked around with `SHOW_ALL` then a hand-rolled DFS).
- `isContentEditable` doesn't always reflect attribute correctly (we added a fallback).
- `Element.style` value-parsing normalises differently than Chrome (`5px solid red` → `red solid 5px`).
- `querySelectorAll` accepts some malformed selectors that real browsers reject.

These tests passing in happy-dom does not guarantee they pass in Chrome. The E2E layer is supposed to catch divergence but is currently too thin.

#### 17. **Integration test "selector returns 2" relies on the strategy being registered**
The test silently assumes Phase 2 wiring is in place. If selector strategy were unregistered, the test would still pass with a different code path that's not actually the production one. Brittle.

#### 18. **Storage E2E doesn't test cross-page**
The puppeteer `file://` URL setup gives each page its own localStorage. The "persistence across reload" test was rewritten to only verify same-session round-trip. Real persistence across page navigation is untested.

#### 19. **The ReDoS guard is heuristic**
We refuse patterns matching `\([^)]*[+*?][^)]*\)[+*]`. This catches the classic `(X+)+` family but:
- False negatives: `\b(\w+)+\b` won't match our regex (no `+` inside the group character-wise — it's after `\w`, which IS a `+` thing, so it might catch it; need to check). Actually `\w+` does match `[^)]*[+*?][^)]*` (where `[+*?]` matches the `+`). OK.
- False negatives: `(?:a+)+` uses non-capturing group syntax, our regex starts with `\(` and matches that. OK.
- False negatives: backreferences. `(a)\1+` could theoretically be slow but we don't detect.
- False positives: `(a?)b` matches our pattern (has `?` inside, `b` outside but no `+*` quantifier — `\)[+*]` requires `+` or `*` right after, so `(a?)b` doesn't match). OK.

The heuristic is decent but not airtight. We don't have tests for the false-positive / false-negative boundaries.

#### 20. **No browser-compat matrix**
All E2E runs against one Chrome version (148). No Firefox. No Safari. No Edge. The script targets Chromium ≥ 110 but we don't verify older Chromes.

#### 21. **No GM_* compatibility matrix**
We use the Tampermonkey API surface (`GM_addValueChangeListener` is Tampermonkey-only). Behaviour on Violentmonkey / Greasemonkey 4 is untested.

---

## Honest confidence rating

| Layer | Confidence | Why |
|---|---|---|
| Pure search functions (text/regex/timestamp/selector/jsquery) | **High** | Pure, well-tested, edge cases covered |
| State store + persistence merge logic | **High** | Tested directly, mostly-pure |
| `safe.js` defence | **Medium-high** | Core property tested; coverage in callers not enforced |
| Highlight + element outline | **Medium** | Module-level tests pass; not asserted end-to-end |
| UI wiring (state → views) | **Low** | Tested only via "doesn't crash" E2E |
| Cross-tab sync | **Low-medium** | Merge function tested; plumbing untested |
| Observer / nav / settling | **Low** | Module-level only, no integration verifying the cascade |
| Adversarial-page handling | **Low** | Hostile-CSS fixture loads but we don't verify the panel renders correctly |
| First-run UX, menu commands | **Very low** | Effectively untested |
| Browser compat | **None** | Only Chrome 148 |

---

## What to add first if test budget were unlimited

In priority order:

1. **Test hook for piercing the shadow root** in dev builds: expose `window.__SS_TEST__ = { state, dispatch, ... }` when `__SS_DEV__` is true. Unlocks ~10 critical E2E gaps (#1-#9).
2. **Two-page cross-tab E2E** with a local HTTP fixture server. Closes gap #2.
3. **MutationObserver-driven re-search E2E** once #1 is unlocked.
4. **Perf assertion in CI** — fail build if 50k-node search > 200ms p95 in Chrome.
5. **Bundle-size assertion** as a hard fail, not a warn.
6. **safe.js grep lint** preventing direct `Array.from` / `MutationObserver` / etc. references outside `safe.js`.
7. **Visual regression** via Puppeteer screenshots for at least the hostile-CSS case.
8. **Run the SMOKE.md manual checklist** at least once. Most likely to surface a real bug.

The cheapest thing of these is #8.
