// Probes how much localStorage the browser accepts and what the app does when a write fails.
import { chromium, openPage, BASE, save } from './common.mjs';
const browser = await chromium.launch();
const { ctx, page } = await openPage(browser, { profile: 'desktop' });
await page.goto(BASE, { waitUntil: 'load' });
const quota = await page.evaluate(() => {
  const k = 'perf:probe'; const chunk = 'x'.repeat(100 * 1024); let s = '';
  try { while (true) { s += chunk; localStorage.setItem(k, s); } } catch (e) { localStorage.removeItem(k); return { acceptedChars: s.length - chunk.length, error: e.name }; }
});
// Fill storage to near-limit, then try to add a loan and see whether the UI errors or silently loses data.
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.evaluate((n) => { localStorage.setItem('perf:filler', 'x'.repeat(n)); }, Math.max(0, quota.acceptedChars - 200 * 1024));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
let uiState = 'ok';
try {
  await page.getByText("I'm borrowing something", { exact: true }).click({ timeout: 8000 });
  await page.getByPlaceholder('Ladder').fill('Quota item'); await page.getByPlaceholder('Type a name').fill('Quota person');
  await page.getByText('Log it', { exact: true }).click({ timeout: 8000 });
  await page.waitForTimeout(1500);
} catch (e) { uiState = String(e.message).split('\n')[0]; }
const stored = await page.evaluate(() => localStorage.getItem('lendly:loans'));
const persisted = !!stored && stored.includes('Quota') || (await page.evaluate(() => (localStorage.getItem('lendly:items') || '').includes('Quota item')));
save('browser-storage-limit', { quota, nearLimit: { uiState, persisted, errors: errs.slice(0, 5) } });
console.log(JSON.stringify({ quota, uiState, persisted, errors: errs.slice(0, 3) }));
await browser.close();
