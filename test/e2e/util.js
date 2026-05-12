import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GM_SHIM } from './gmShim.js';

const ROOT = resolve(import.meta.dirname, '../..');
const BUNDLE = resolve(ROOT, 'super-search.user.js');
const FIXTURES = resolve(ROOT, 'test/fixtures');
const CHROME = '/Users/jos/.cache/puppeteer/chrome-headless-shell/mac_arm-148.0.7778.97/chrome-headless-shell-mac-arm64/chrome-headless-shell';

export async function launch() {
  return puppeteer.launch({
    headless: 'shell',
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--disable-features=IsolateOrigins,site-per-process'],
    timeout: 15000,
  });
}

export function loadBundle() {
  // Strip the userscript header so we don't choke the page parser; only the
  // IIFE body needs to run.
  const raw = readFileSync(BUNDLE, 'utf8');
  const idx = raw.indexOf('// ==/UserScript==');
  return idx >= 0 ? raw.slice(idx + '// ==/UserScript=='.length) : raw;
}

export function fixtureUrl(name) {
  return 'file://' + resolve(FIXTURES, name);
}

export async function openFixture(browser, name) {
  const page = await browser.newPage();
  // Capture console + uncaught errors for debugging.
  page.on('pageerror', err => console.error('[page]', err.message));
  // Inject GM_* shim early.
  await page.evaluateOnNewDocument(GM_SHIM);
  // Inject bundle as a content script after the page loads.
  await page.goto(fixtureUrl(name));
  await page.evaluate(loadBundle());
  await page.waitForFunction(() => {
    return !!document.documentElement.querySelector('div[id^="ss-"]');
  }, { timeout: 5000 });
  return page;
}

export async function pressShortcut(page) {
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('F');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
}

// Run a function inside a closed shadow root by querying for the panel host
// and asking the page to evaluate against it (closed shadow roots are not
// accessible from outside; we run code in-page where it can access them
// because our IIFE keeps a reference internally).
export async function getSummaryText(page) {
  return page.evaluate(() => {
    // We can find the shadow root only through our IIFE's captured ref; not
    // exposed externally. Instead expose a debug hook for tests: read state
    // via the storage envelope counter that we set.
    return window.__SS_TEST_SUMMARY__ || '';
  });
}

export async function getMatchCount(page) {
  return page.evaluate(() => {
    if (typeof CSS === 'undefined' || !CSS.highlights) return -1;
    const all = CSS.highlights.get('ss-all');
    const active = CSS.highlights.get('ss-active');
    return (all ? all.size : 0) + (active ? active.size : 0);
  });
}
