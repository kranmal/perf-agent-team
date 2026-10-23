import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const config = () => readJson(path.join(ROOT, 'perf.config.json'));
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
export function hostGuard(baseUrl, cfg, profile) {
  const host = new URL(baseUrl).hostname;
  const local = LOCAL.has(host) || host.endsWith('.localhost') || host.endsWith('.test');
  if (local) return;
  const allowed = cfg.allowRemote && (cfg.remoteHostsAllowed || []).includes(host);
  if (!allowed) throw new Error(`Refusing to load-test ${host}: add it to remoteHostsAllowed and set allowRemote=true only if you own it or have written permission.`);
  if (['stress', 'spike', 'soak'].includes(profile) && process.env.ALLOW_HEAVY_REMOTE !== '1')
    throw new Error(`Refusing ${profile} against remote host ${host} without ALLOW_HEAVY_REMOTE=1 (never production).`);
}

// k6 summary values live in m.values (older) or directly on m (newer); handle both.
export const vals = (m) => (m && (m.values || m)) || {};

export async function htmlToPdf(htmlPath, pdfPath) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { console.warn('playwright not installed; HTML only'); return false; }
  const b = await chromium.launch();
  const pg = await b.newPage();
  await pg.goto('file://' + htmlPath);
  await pg.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
  await b.close();
  return true;
}

export const CSS = `
body{font:13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1d23;margin:0}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:26px 0 8px;border-bottom:2px solid #e3e6ec;padding-bottom:4px}h3{font-size:14px;margin:16px 0 4px}
table{border-collapse:collapse;width:100%;margin:8px 0;page-break-inside:auto}tr{page-break-inside:avoid}
th,td{border:1px solid #d9dde5;padding:5px 8px;text-align:left;vertical-align:top}th{background:#f2f4f8}
.pass{color:#0a7d36;font-weight:700}.fail{color:#c0271f;font-weight:700}.info{color:#6b7280}
.cover{padding:40px 0 20px;border-bottom:4px solid #2b59c3;margin-bottom:10px}.meta{color:#555}
.card{display:inline-block;border:1px solid #d9dde5;border-radius:6px;padding:8px 14px;margin:4px 6px 4px 0}
.card b{display:block;font-size:20px}.bar{height:10px;background:#e3e6ec;border-radius:5px;overflow:hidden}.bar i{display:block;height:10px;background:#2b59c3}
.note{background:#fff8e1;border-left:4px solid #f0b429;padding:8px 12px;margin:8px 0}
code{background:#f2f4f8;padding:1px 4px;border-radius:3px}
`;
