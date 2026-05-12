// Help modal inside the panel's shadow root. Plain DOM, no innerHTML.
// Toggled visible by a `?` button in the panel header.
import { el } from '../dom.js';

let modalEl = null;

const SECTIONS = [
  {
    h: 'Keyboard',
    rows: [
      ['Ctrl+Shift+F', 'Toggle the panel'],
      ['Enter', 'Next match (in Text / CSS mode)'],
      ['Shift+Enter', 'Previous match'],
      ['Ctrl+Enter', 'Run JS query (in JS mode)'],
      ['Escape', 'Hide panel'],
      ['Arrow Left / Right', 'Switch search mode'],
    ],
  },
  {
    h: 'Search modes',
    items: [
      {
        title: 'Text',
        body: 'Plain text, case-insensitive. Auto-detects regex if wrapped in slashes and timestamp ranges.',
        examples: [
          ['lorem ipsum', 'plain text'],
          ['/error \\d+/gi', 'regex with flags'],
          ['1:00-2:30', 'find timestamps in this range'],
          ['01:00:00-02:30:00', 'HH:MM:SS form'],
        ],
      },
      {
        title: 'CSS',
        body: 'CSS selectors (querySelectorAll). Matched elements get a dashed pink outline.',
        examples: [
          ['div.warning > p', 'descendant selectors'],
          ['a[href*="example.com"]', 'attribute filters'],
          ['[data-id]:not(.hidden)', 'pseudo-class + attribute'],
          ['table tr:nth-child(odd)', 'positional selectors'],
        ],
      },
      {
        title: 'JS',
        body: 'Run JavaScript in the page realm. Result is classified:\n  Element / NodeList → highlighted on page\n  Array of strings → shown in the match list\n  Anything else → coerced to string\nThe Dump button copies the last result to window.superSearchResults so you can grab it from DevTools.',
        examples: [
          ['return document.title', 'a single value'],
          ['return [...document.querySelectorAll("a")].map(a=>a.href)', 'array of strings'],
          ['return document.querySelector("#main")', 'an element'],
          ['return Array.from(document.images).map(i=>i.src)', 'all image URLs'],
        ],
      },
    ],
  },
  {
    h: 'Options',
    items: [
      {
        title: 'Live',
        body: 'Search as you type (100ms debounce). Off → manual via Go button or Enter. JS mode is always manual to avoid eval\'ing half-typed expressions.',
      },
      {
        title: 'Append',
        body: 'Collect match values into one running list across all tabs.\nUse this when you\'re scanning N tabs to gather results, e.g. searching for the same product across 20 shopping pages and copying the list out. Persists across reloads and tabs.',
      },
      {
        title: 'Dedupe',
        body: 'Display-only filter: hide duplicate rows. Combine with Append for a unique cross-tab collection.',
      },
      {
        title: 'Log',
        body: 'Different from Append. Log is an audit trail with timestamps + URLs of every find. Use this when you want to know when and where a value appeared, not just collect the values.\nLog dedupes by (value, before, after, url) within a session so live-mode typing isn\'t spammy.',
      },
    ],
  },
  {
    h: 'Buttons',
    items: [
      { title: 'Go', body: 'Run search manually (visible when Live is off, or always in JS mode).' },
      { title: '< / >', body: 'Previous / next match. Same as Shift+Enter / Enter inside the search box.' },
      { title: 'Copy', body: 'Copy the visible match list to the clipboard, tab-separated. Cross-page rows include their URL.' },
      { title: 'Dump', body: 'Only visible after a JS query. Writes the result to window.superSearchResults for inspection in DevTools.' },
      { title: 'Clear', body: 'Clears matches + accumulated list + log. Cross-tab synced — clears on all your tabs.' },
    ],
  },
  {
    h: 'Tips',
    items: [
      { title: 'Shortcut blocked by host page', body: 'Some sites capture Ctrl+Shift+F (Notion, Slack, Google Docs). Use the Tampermonkey extension menu: "Super Search: Toggle panel".' },
      { title: 'Single-page apps', body: 'Search auto re-runs on SPA navigation and DOM updates. If the page is "settling" (still loading content), an orange pulsing dot appears next to the match count — results will refresh once the page quiets.' },
      { title: 'Big pages', body: 'Search is capped at 100k text nodes per run. If a result reads "(partial)" the page exceeded that — refine the query or use CSS mode for structural search.' },
      { title: 'Privacy', body: 'Toggle "Incognito" from the Tampermonkey menu to stop persistence for the session. URLs are stored without query strings or hashes so auth tokens don\'t leak.' },
    ],
  },
];

export function build() {
  modalEl = el('div', { class: 'ss-help-modal', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Help' });

  const header = el('div', { class: 'ss-help-header' },
    el('div', { class: 'ss-help-title' }, 'Super Search — Help'),
    el('button', {
      type: 'button',
      class: 'ss-help-close',
      'aria-label': 'Close help',
      onClick: () => hide(),
    }, '×'),
  );

  const body = el('div', { class: 'ss-help-body' });
  for (const sec of SECTIONS) {
    body.appendChild(el('h3', { class: 'ss-help-h' }, sec.h));
    if (sec.rows) {
      const t = el('table', { class: 'ss-help-table' });
      for (const [k, v] of sec.rows) {
        t.appendChild(el('tr', {},
          el('td', { class: 'ss-help-key' }, k),
          el('td', { class: 'ss-help-val' }, v),
        ));
      }
      body.appendChild(t);
    }
    if (sec.items) {
      for (const it of sec.items) {
        body.appendChild(el('div', { class: 'ss-help-item' },
          el('div', { class: 'ss-help-item-title' }, it.title),
          el('div', { class: 'ss-help-item-body' }, it.body),
          ...(it.examples
            ? [el('ul', { class: 'ss-help-examples' },
                ...it.examples.map(([code, note]) => el('li', {},
                  el('code', {}, code),
                  el('span', { class: 'ss-help-note' }, ' — ' + note),
                )),
              )]
            : []),
        ));
      }
    }
  }

  modalEl.appendChild(header);
  modalEl.appendChild(body);

  // Click outside the modal body to close.
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) hide(); });
  // Esc inside the modal closes.
  modalEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
  });

  return modalEl;
}

export function show() {
  if (!modalEl) return;
  modalEl.hidden = false;
  modalEl.querySelector('.ss-help-close')?.focus();
}

export function hide() {
  if (!modalEl) return;
  modalEl.hidden = true;
}

export function toggle() {
  if (!modalEl) return;
  if (modalEl.hidden) show(); else hide();
}

export function isVisible() { return modalEl && !modalEl.hidden; }
