# Super Search — Manual Smoke Checklist

Run this before tagging a release. Each site takes ~5 minutes.

## Wikipedia (long article)

URL: any long article (e.g. `https://en.wikipedia.org/wiki/JavaScript`).

- [ ] `Ctrl+Shift+F` opens panel; cursor lands in the input.
- [ ] Type `JavaScript` → matches highlight in orchid; counter shows `1 / N`.
- [ ] Press Enter → active match jumps to next, scrolls into view, turns lime green.
- [ ] Type `/\bES\d+\b/` → regex auto-detected; finds ES5, ES6, etc.
- [ ] Switch to `CSS` mode, query `h2` → headings get dashed pink outline.
- [ ] Press `Ctrl+Shift+F` again → panel hides.
- [ ] Reload page → panel state restored (query, mode, visibility).

## YouTube (with transcript open)

URL: a video that has a transcript (e.g. a long talk).

- [ ] Open transcript via the YouTube ⋯ menu.
- [ ] In Super Search, type `1:00-3:00` → timestamps in that range highlight only.
- [ ] Let video autoplay for 1 minute. Observer should not auto-pause (≤ 5 events / 10 s).
- [ ] If observer does auto-pause, note "auto-paused" appears in diagnostics; manual Resume from menu.

## GitHub PR list → diff (cross-page append)

- [ ] Open Tampermonkey menu → toggle Append mode ON via the panel.
- [ ] On the PR list page, search `bot` → notice matches in list.
- [ ] Click into a PR's `Files changed` tab — match list still shows the PR-list matches **with URL badge**.
- [ ] Search again on the diff → both sets present.
- [ ] Click Copy → paste into a notes app → both pages' matches present, tab-separated by source URL.

## MDN (technical article)

URL: any reference page with code examples.

- [ ] Switch to `JS` mode.
- [ ] Query: `return [...document.querySelectorAll("code")].map(c => c.textContent.slice(0, 60))`
- [ ] Panel shows string-match rows.
- [ ] Click `Dump` → open DevTools console → `window.superSearchResults` is the array.

## Hostile-CSS site (any heavy CSS framework site)

URL: any site with strong CSS that uses `!important` or `* { ... }` rules.

- [ ] Panel renders correctly — orchid bg, pink outlines, lime active.
- [ ] Host page's styles are unaffected by panel presence.
- [ ] Panel position stays top-right despite host page's CSS.

## Cross-tab sync (P1 use case)

- [ ] Open three Wikipedia tabs.
- [ ] In tab 1, enable Append mode, search for `the` (or any common word).
- [ ] In tab 2 (no need to open panel), reload — observe historical includes tab 1's matches.
- [ ] In tab 3, open panel, append-mode-search a different word.
- [ ] Back in tab 1, panel reflects tab 3's additions within ~500ms.
- [ ] In tab 1, click Clear All → all tabs' panels show empty list shortly after.

## First-run UX

- [ ] In a fresh browser profile (or after Clear All + clearing `ss.bootedOnce`):
- [ ] Navigate to any page. Panel **auto-opens** with first-run banner visible.
- [ ] Close the panel. Reload. Panel remains closed (or as last user state).

## Privacy

- [ ] Toggle Incognito via Tampermonkey menu.
- [ ] Perform a search with Append on. No matches should be persisted to GM storage.
- [ ] Verify in Tampermonkey storage viewer that `ss.historical.v1` is empty (or unchanged).

## Diagnostics

- [ ] Toggle Diagnostics via Tampermonkey menu.
- [ ] Open DevTools console. Subsequent searches log `[super-search] ...` entries.
- [ ] Cause an error (e.g. type an invalid regex like `/[/`). Error appears in console + in panel log pane (if log is enabled).

## Performance sanity

- [ ] On the largest page you can find (a long blog post, mailing-list archive, etc.), open the panel and type a common word.
- [ ] Live mode keeps up — no visible lag while typing.
- [ ] Browser stays responsive.
- [ ] Switch tabs, return — panel state intact.

---

## Sign-off

- Date:
- Browser & version:
- Tampermonkey version:
- Issues found:
