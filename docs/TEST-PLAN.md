# Super Search — Test Plan

This plan describes how Super Search is tested. Concrete test cases live in [TEST-CASES.md](./TEST-CASES.md); requirements they validate live in [REQUIREMENTS.md](./REQUIREMENTS.md).

---

## 1. Test Pyramid & Goals

```
                ┌─────────────────────────┐
                │  Manual smoke + live    │   ~5 sites, opt-in
                │       sites (E2E-live)  │
                ├─────────────────────────┤
                │   E2E in headless       │   ~30 scenarios, deterministic
                │     Chrome (CDP)        │
                ├─────────────────────────┤
                │  Integration (happy-dom) │   ~20 scenarios
                ├─────────────────────────┤
                │      Unit (bun test)     │   ~80 cases, fast
                └─────────────────────────┘
```

**Goal:** every functional requirement (FR-01 … FR-20) has at least one automated test. Every non-functional requirement that can be measured (NFR-01, NFR-02, NFR-04) has a perf or static check.

**Coverage target:** 80% line coverage of `src/search/**` and `src/state.js`; UI files measured manually via E2E.

---

## 2. Tooling Stack

| Layer | Tool | Why |
|---|---|---|
| Test runner | **`bun test`** | Fast, native ESM, built-in coverage |
| Headless DOM | **`happy-dom`** | Faster than jsdom; supports `Range`, `TreeWalker`, `MutationObserver`, basic `CSS.highlights` stub |
| E2E driver | **Puppeteer** (CDP) | Standard, has `evaluateOnNewDocument` for userscript injection |
| Bundler (for E2E) | **esbuild** | Same as production build |
| Fixtures | Static HTML files | Deterministic, offline |
| Coverage | `bun test --coverage` | Default |
| CI | local `bun test:all` script + git pre-push hook | No remote CI in v1 |

`GM_*` API is stubbed by `test/setup-gm.js` for both unit and E2E (in E2E the stub is injected via `page.evaluateOnNewDocument`).

---

## 3. Unit Tests

### 3.1 Scope
Pure modules:
- `src/search/text.js`, `regex.js`, `timestamp.js`, `selector.js`, `jsquery.js`
- `src/search/dispatcher.js`
- `src/state.js`
- `src/util/*`

### 3.2 Conventions
- One file per module: `test/unit/<module>.test.js`.
- AAA layout (`Arrange / Act / Assert`).
- No mocking of DOM APIs that `happy-dom` provides natively (`Range`, `TreeWalker`).
- `GM_*` is mocked via in-memory stub set up in `test/setup-gm.js`.

### 3.3 Coverage by feature

| Feature | Tests live in | Notes |
|---|---|---|
| Text search | `text.test.js` | NBSP handling, case-fold, overlap, unicode |
| Regex search | `regex.test.js` | Zero-width guard, default flags, invalid syntax |
| Timestamp | `timestamp.test.js` | Format parsing, range inclusion, malformed input |
| Selector | `selector.test.js` | Valid selectors, invalid selectors throw, no-match |
| JS query | `jsquery.test.js` | Each result-type branch, throwing eval |
| Dispatcher | `dispatcher.test.js` | Auto-detection table |
| Store | `state.test.js` | `set` notifies, persistence debounce, FIFO cap |
| Storage | `storage.test.js` | Round-trip, cross-tab listener, conflict merge |

---

## 4. Integration Tests

### 4.1 Scope
Multiple modules wired together but **without Chrome**. Runs in `happy-dom`.

Examples:
- Dispatcher + text strategy + highlight: load a fixture, run dispatcher, verify `CSS.highlights.get('ss-all').size`.
- Observer + dispatcher: mutate the DOM via fixture, assert search re-ran.
- State + storage round-trip: change state, await debounced persist, read storage, simulate cross-tab change event, assert merged state.
- Append mode merge logic: union by `Match.id`, run twice with overlapping inputs, assert no duplicates.

### 4.2 Setup
`test/integration/` mirrors `src/` structure. Each test imports real modules; the only thing faked is `GM_*` and `navigator.clipboard`.

---

## 5. E2E Tests (Puppeteer + headless Chrome)

### 5.1 Architecture

```js
// test/e2e/runner.mjs
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page    = await browser.newPage();

// Stub GM_* before any host page script runs.
await page.evaluateOnNewDocument(GM_SHIM);

// Load the production-built userscript bundle.
const bundle = readFileSync('super-search.user.js', 'utf8');
await page.evaluateOnNewDocument(bundle);

await page.goto(`file://${process.cwd()}/test/fixtures/basic.html`);
```

`GM_SHIM` provides:
- `GM_addStyle` → appends `<style>`.
- `GM_getValue` / `GM_setValue` → backed by `localStorage` (per-tab).
- `GM_addValueChangeListener` / `GM_removeValueChangeListener` → backed by `window.addEventListener('storage', …)` so cross-tab tests work using two `page.newPage()` instances on the same origin.

### 5.2 Cross-tab tests
Open two `Page` instances served from the same `file://` origin (Puppeteer treats `file://` origins as same-origin for `localStorage`-backed sync via the `storage` event polyfill in the shim). Run search in page A; assert page B's panel reflects the new historical entries within 500ms.

### 5.3 Categories

| Category | Count | Goal |
|---|---|---|
| Smoke | 5 | Panel opens, basic search works on a paragraph fixture |
| Per-mode | 10 | One scenario for each FR-03 sub-mode + selector + JS |
| Navigation | 4 | Next, prev, wrap, scroll-into-view assertion |
| List & append | 5 | Single-page, cross-page, cross-tab, dedupe, copy |
| Live + observer | 3 | Live debounce, observer re-search, observer gated when hidden |
| Persistence | 3 | Reload preserves UI state, restores historical, log |
| Resilience | 3 | Invalid regex/selector/JS; site CSS overrides; large DOM |

Total ~33 E2E scenarios.

### 5.4 Optional Chrome DevTools MCP
Recommend installing `chrome-devtools-mcp` so future Claude sessions can drive a live Chrome interactively (not in CI):

```
claude mcp add chrome-devtools -- npx @modelcontextprotocol/server-chrome-devtools
```

E2E suite itself uses Puppeteer directly (deterministic, scriptable).

---

## 6. Performance Tests

Located in `test/perf/`. Run on demand (`bun test:perf`), not in default `bun test:all`.

| Test | Fixture | Metric | Threshold (p95 over 10 runs) |
|---|---|---|---|
| Text search on large page | 50k text nodes | total search time | ≤ 500ms |
| Live keystroke latency | same | input → highlight render | ≤ 200ms |
| Regex with `g` flag | same, /\w+/g | total search time | ≤ 700ms |
| Observer overhead while hidden | same, mutate 100/s | CPU time per second | ≤ 5ms |
| Storage write burst | 100 `set()` in 1s | wall time | ≤ 300ms (debounce works) |

Thresholds are guidelines; regressions investigated, not necessarily failing.

---

## 7. Manual Smoke Tests

Before each release tag, run the checklist in `test/manual/SMOKE.md`. Five real sites:

1. **Wikipedia** (long article) — text + regex modes work; navigation scrolls correctly.
2. **YouTube** (with transcript open) — timestamp mode works on transcript text; observer doesn't loop on autoplay.
3. **GitHub** (large PR diff) — selector mode (`span.blob-code-marker-addition`); cross-page append from PR list page → PR diff page.
4. **MDN** (technical article) — JS mode (`document.querySelectorAll('code').map(c => c.textContent)`); Dump works.
5. **Heavy SPA** (Twitter/X or similar) — observer keeps up with infinite scroll; panel CPU stays low when hidden.

Each site: ~5 minutes of clicking through the documented FRs.

---

## 8. Live-Site E2E (opt-in)

`bun test:e2e:live` runs a tiny suite against real URLs. Not in default CI loop (network-flaky, slow).

Use it to catch regressions only Wikipedia/YouTube/etc. surface — host CSS conflicts, anti-scraping rate limits affecting `MutationObserver` cascades.

---

## 9. Fixture Strategy

`test/fixtures/`:

| Fixture | Purpose |
|---|---|
| `basic.html` | 50 paragraphs of "Lorem Ipsum"; known word counts. |
| `nbsp.html` | Phrases containing `&nbsp;` mid-sentence. |
| `nested.html` | Deeply nested elements (10+ levels). |
| `dynamic.html` | `setTimeout` adds content after load (1s + 3s). |
| `transcript.html` | Lines starting with timestamps: `00:00`, `0:45`, `1:30`, `2:30`, `01:01:25`. |
| `invisible.html` | Contains `display:none` and `visibility:hidden` regions. |
| `shadow.html` | Open shadow root; v1 should *not* find content inside (negative test). |
| `iframe.html` | Same-origin iframe; v1 should *not* find content inside (negative test). |
| `large.html` | Generated by `test/fixtures/gen-large.mjs` to 50k text nodes; gitignored. |
| `hostile-css.html` | Has CSS rules like `* { outline: 5px solid red !important }` to stress isolation. |

`gen-large.mjs` is checked in; `large.html` is regenerated on `bun test:perf`.

---

## 10. Test Data Conventions

- All matches counted in fixtures are commented at the top of each fixture: `<!-- expected: 17 matches of "lorem" (case-insensitive) -->`.
- Test asserts read those expectations from a sibling JSON file, e.g. `basic.expected.json`, to avoid duplication.

---

## 11. CI Runtime Budget

| Suite | Budget |
|---|---|
| `bun test` (unit + integration) | ≤ 5s |
| `bun test:e2e` | ≤ 60s |
| `bun test:perf` | ≤ 30s |
| `bun test:e2e:live` | ≤ 120s (manual only) |

If unit exceeds 5s, that's a signal we're using `happy-dom` for things that should be E2E.

---

## 12. Coverage Targets

| Module | Target |
|---|---|
| `src/search/**` | ≥ 90% line, ≥ 80% branch |
| `src/state.js` | ≥ 90% line |
| `src/storage.js` | ≥ 80% line |
| `src/util/**` | ≥ 95% line |
| `src/ui/**` | not measured; covered by E2E |

Run: `bun test --coverage`. CI does not enforce thresholds (no remote CI in v1); pre-push hook prints them.

---

## 13. Bug Triage Flow

A new bug:
1. Reproduce in the smallest possible HTML fixture; add it to `test/fixtures/`.
2. Write a failing test that asserts the expected behaviour.
3. Fix the code.
4. Verify the test passes; verify nothing else regressed.
5. If the bug is real-site-specific (couldn't repro in a fixture), document it in `test/manual/known-issues.md` and add to the live-site suite if useful.

---

## 14. Out-of-Scope Testing

Not tested in v1:
- Cross-browser (Firefox, Safari). Code is feature-detected; we trust the detection.
- Accessibility (screen readers). Tool is a power-user utility; deferred.
- Mobile gestures.
- Network reliability of `chrome-devtools-mcp` (not used in CI).
- Concurrent userscript collisions (e.g. another script that also defines `superSearchResults`).

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `happy-dom` doesn't fully implement `CSS.highlights` | Stub it in test setup; assert via state, not via rendered highlights. |
| Puppeteer headless flakiness with `file://` URLs | Use `--allow-file-access-from-files` and same-origin file URLs. |
| `GM_addValueChangeListener` behaviour differs in real Tampermonkey vs our shim | Manual smoke test covers real-Tampermonkey case before each release. |
| Cross-tab E2E flakiness via `storage` event | Use a 500ms polling-with-timeout assertion, not a fixed `setTimeout`. |
| Real-site E2E flakes from anti-bot measures | Live suite is opt-in; not part of default CI loop. |
