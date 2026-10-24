// Seeds localStorage with N loans (and matching items/people) and measures startup and interactions.
import { chromium, openPage, BASE, median, pct, r1, save, metricsOf } from './common.mjs';

const SIZES = (process.env.SIZES || '0,100,1000,2500,5000,20000').split(',').map(Number);
const PROFILE_LIST = (process.env.PROFILES || 'desktop,phone-4x').split(',');
const TIMEOUT = Number(process.env.STARTUP_TIMEOUT_MS || 90000);
const ACTIVE_SHARE = 0.3;
const repsFor = (n) => (n <= 1000 ? 10 : n <= 5000 ? 3 : 1);

export function dataset(n) {
  const people = Array.from({ length: Math.max(n ? 5 : 0, Math.round(n / 10)) }, (_, i) => ({ id: `p${i}`, name: `Person ${i}`, createdAt: 1700000000000 + i }));
  const items = [], loans = [];
  for (let i = 0; i < n; i++) {
    items.push({ id: `i${i}`, name: `Item ${i}`, category: 'Tools', createdAt: 1700000000000 + i });
    const active = i < Math.round(n * ACTIVE_SHARE);
    loans.push({ id: `l${i}`, itemId: `i${i}`, personId: `p${i % people.length}`, direction: 'lent_out', dateOut: 1700000000000 + i * 1000, expectedReturn: active ? 1800000000000 + i * 1000 : undefined, actualReturn: active ? undefined : 1700500000000, status: active ? 'active' : 'returned' });
  }
  return { items, people, loans, active: loans.filter((l) => l.status === 'active').length };
}

// In-page helpers: the Home subtitle ("N items out") is the cheap-to-read signal that the store has rendered.
const INIT = (ds) => {
  const t0 = performance.now();
  try {
    localStorage.setItem('lendly:items', ds.items); localStorage.setItem('lendly:people', ds.people); localStorage.setItem('lendly:loans', ds.loans);
  } catch (e) { window.__seedError = String(e); }
  window.__lt = []; window.__click = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  document.addEventListener('click', (e) => { window.__click = e.timeStamp; }, true);
  window.__sub = () => {
    if (window.__subEl && window.__subEl.isConnected) return window.__subEl;
    const w = document.createTreeWalker(document.body || document, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (n.nodeValue === 'Lendly') { window.__subEl = n.parentElement.nextElementSibling; return window.__subEl; }
    return null;
  };
};
const waitCount = (page, active, timeout) => page.waitForFunction((a) => {
  const el = window.__sub && window.__sub(); if (!el) return false;
  const t = el.textContent || '';
  return (a === 0 ? t.startsWith("Nothing's out") : t.startsWith(a + ' item')) ? performance.now() : false;
}, active, { polling: 'raf', timeout });
const ltSum = (page, from, to) => page.evaluate(([f, t]) => window.__lt.filter(([s]) => s >= f && s <= t).reduce((s, [, d]) => s + d, 0), [from, to]);

async function once(browser, profile, n) {
  const ds = dataset(n);
  const seed = { items: JSON.stringify(ds.items), people: JSON.stringify(ds.people), loans: JSON.stringify(ds.loans) };
  const chars = seed.items.length + seed.people.length + seed.loans.length;
  const { ctx, page, cdp } = await openPage(browser, { profile, init: `(${INIT})(${JSON.stringify(seed)})` });
  await cdp.send('Performance.enable');
  const r = { storageMB: r1(chars / 1048576) };
  try {
    await page.goto(BASE, { waitUntil: 'commit', timeout: TIMEOUT });
    const seedErr = await page.evaluate(() => window.__seedError).catch(() => null);
    if (seedErr) return { ...r, error: 'could not seed: ' + seedErr };
    const tStart = await waitCount(page, ds.active, TIMEOUT).then((h) => h.jsonValue());
    r.startupMs = tStart; r.startupLongTaskMs = await ltSum(page, 0, tStart);
    r.heapMB = r1((await metricsOf(cdp)).JSHeapUsedSize / 1048576);
    r.domNodes = await page.evaluate(() => document.getElementsByTagName('*').length);
    await page.waitForTimeout(500);

    // Switch to Items tab: click -> two animation frames
    const itemsLink = page.getByRole('link', { name: 'Items' });
    await page.evaluate(() => { window.__t = performance.now(); });
    await itemsLink.click({ timeout: TIMEOUT });
    r.itemsTabMs = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - window.__click)))));
    await page.getByRole('link', { name: 'Home' }).click({ timeout: TIMEOUT });
    await page.waitForTimeout(300);

    // Open Borrow modal: click -> input visible
    await page.getByText("I'm borrowing something", { exact: true }).click({ timeout: TIMEOUT });
    r.openModalMs = await page.waitForFunction(() => document.querySelector('input[placeholder="Ladder"]') ? performance.now() - window.__click : false, null, { polling: 'raf', timeout: TIMEOUT }).then((h) => h.jsonValue());
    await page.getByPlaceholder('Ladder').fill('Perf ladder');
    await page.getByPlaceholder('Type a name').fill('Perf person');
    await page.waitForTimeout(300);

    // Add loan: click Log it -> Home count increments
    const before = await page.evaluate(() => performance.now());
    await page.getByText('Log it', { exact: true }).click({ timeout: TIMEOUT });
    const tAdd = await waitCount(page, ds.active + 1, TIMEOUT).then((h) => h.jsonValue());
    r.addLoanMs = tAdd - (await page.evaluate(() => window.__click));
    r.addLoanLongTaskMs = await ltSum(page, before, tAdd);
    await page.waitForTimeout(1200); // let the sheet close

    // Mark returned: click first Returned button -> count decrements
    await page.getByText('Returned', { exact: true }).filter({ visible: true }).first().click({ timeout: TIMEOUT });
    const tRet = await waitCount(page, ds.active, TIMEOUT).then((h) => h.jsonValue());
    r.markReturnedMs = tRet - (await page.evaluate(() => window.__click));
  } catch (e) { r.error = String(e.message || e).split('\n')[0]; }
  await Promise.race([ctx.close(), new Promise((res) => setTimeout(res, 5000))]).catch(() => {});
  return r;
}

const out = [];
for (const profile of PROFILE_LIST) for (const n of SIZES) {
  const browser = await chromium.launch(); // fresh browser per size: a hung page cannot affect the next
  const runs = [];
  for (let i = 0; i < repsFor(n); i++) { runs.push(await once(browser, profile, n)); if (runs.at(-1).error) break; }
  await Promise.race([browser.close(), new Promise((res) => setTimeout(res, 5000))]).catch(() => {});
  const ok = runs.filter((r) => !r.error);
  const keys = ['startupMs', 'startupLongTaskMs', 'itemsTabMs', 'openModalMs', 'addLoanMs', 'addLoanLongTaskMs', 'markReturnedMs', 'heapMB', 'domNodes', 'storageMB'];
  const summary = Object.fromEntries(keys.map((k) => [k, ok.length ? { median: r1(median(ok.map((r) => r[k]))), p95: r1(pct(ok.map((r) => r[k]), 95)) } : null]));
  const error = runs.find((r) => r.error)?.error;
  out.push({ profile, loans: n, reps: runs.length, completed: ok.length, error, summary, runs });
  console.log(profile, n, 'startup', summary.startupMs?.median, 'add', summary.addLoanMs?.median, 'items', summary.itemsTabMs?.median, error ? 'ERR ' + error : '');
}
save('browser-data-scale', { sizes: SIZES, activeShare: ACTIVE_SHARE, startupTimeoutMs: TIMEOUT, results: out });
