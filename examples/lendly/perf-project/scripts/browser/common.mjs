import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, hostGuard, config } from '../lib.mjs';

export const BASE = (process.env.BASE_URL || config().baseUrl).replace(/\/$/, '') + '/';
hostGuard(BASE, config(), 'load'); // browser tests are local-only too

export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
export const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null; };
export const r1 = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);

export const PROFILES = {
  desktop: { cpu: 1, net: null },
  'phone-4x-slow4g': { cpu: 4, net: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } },
  'phone-4x': { cpu: 4, net: null },
};

export async function openPage(browser, { profile = 'desktop', blockAds = true, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (blockAds) await ctx.route(/googlesyndication|doubleclick|googleadservices/, (r) => r.abort());
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const p = PROFILES[profile];
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  if (p.net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', p.net); }
  return { ctx, page, cdp };
}

export const metricsOf = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

export function save(name, obj) {
  fs.mkdirSync(path.join(ROOT, 'results'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'results', `${name}.json`), JSON.stringify({ at: new Date().toISOString(), base: BASE, ...obj }, null, 2));
}
export { chromium };
