// Cold-load audit: fresh browser context per run (empty cache and storage).
import { chromium, openPage, BASE, median, pct, r1, save, metricsOf } from './common.mjs';

const INIT = () => {
  window.__m = { lcp: 0, cls: 0, lt: [], fcp: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
};

const VARIANTS = [
  { name: 'desktop, ads blocked', profile: 'desktop', blockAds: true, reps: 10 },
  { name: 'phone (4x CPU, slow 4G), ads blocked', profile: 'phone-4x-slow4g', blockAds: true, reps: 10 },
  { name: 'phone (4x CPU, slow 4G), with ads', profile: 'phone-4x-slow4g', blockAds: false, reps: 5 },
];
const browser = await chromium.launch();
const out = [];
for (const v of VARIANTS) {
  const runs = [];
  for (let i = 0; i < v.reps; i++) {
    const { ctx, page, cdp } = await openPage(browser, { ...v, init: INIT });
    await cdp.send('Performance.enable');
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4000);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      const own = res.filter((e) => e.name.includes('localhost'));
      return { ...window.__m, ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd,
        requests: res.length + 1, ownBytes: own.reduce((s, e) => s + e.encodedBodySize, nav.encodedBodySize), thirdParty: res.filter((e) => !e.name.includes('localhost')).length };
    });
    const tbt = m.lt.filter(([s]) => s >= m.fcp).reduce((s, [, d]) => s + Math.max(0, d - 50), 0);
    const cm = await metricsOf(cdp);
    runs.push({ lcp: m.lcp, fcp: m.fcp, cls: m.cls, tbt, ttfb: m.ttfb, load: m.load, requests: m.requests, ownKB: m.ownBytes / 1024, thirdParty: m.thirdParty, scriptMs: cm.ScriptDuration * 1000, heapMB: cm.JSHeapUsedSize / 1048576 });
    await ctx.close();
  }
  const keys = Object.keys(runs[0]);
  const summary = Object.fromEntries(keys.map((k) => [k, { median: r1(median(runs.map((r) => r[k]))), p95: r1(pct(runs.map((r) => r[k]), 95)) }]));
  out.push({ variant: v.name, reps: v.reps, summary, runs });
  console.log(v.name, 'LCP', summary.lcp.median, 'TBT', summary.tbt.median, 'CLS', summary.cls.median);
}
await browser.close();
save('browser-cold-load', { variants: out });
