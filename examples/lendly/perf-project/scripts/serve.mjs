// Local stand-in for GitHub Pages: serves .build/ under /lendly with gzip and 600 s cache, like the live site.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from './lib.mjs';

const DIR = path.join(ROOT, '.build'), PREFIX = '/lendly', PORT = Number(process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf', '.css': 'text/css', '.svg': 'image/svg+xml' };
const cache = new Map();
function resolve(url) {
  let p = decodeURIComponent(url.split('?')[0]);
  if (!p.startsWith(PREFIX)) return null;
  p = p.slice(PREFIX.length) || '/';
  if (p.endsWith('/')) p += 'index';
  for (const c of [p, p + '.html']) { const f = path.join(DIR, c); if (f.startsWith(DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
  return null;
}
http.createServer((req, res) => {
  const f = resolve(req.url);
  if (!f) { res.writeHead(404); return res.end('not found'); }
  const type = TYPES[path.extname(f)] || 'application/octet-stream';
  const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /html|javascript|json|svg|css/.test(type);
  const key = f + gz;
  if (!cache.has(key)) { const raw = fs.readFileSync(f); cache.set(key, gz ? zlib.gzipSync(raw, { level: 6 }) : raw); }
  const body = cache.get(key);
  res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=600', ...(gz ? { 'content-encoding': 'gzip' } : {}), 'content-length': body.length });
  res.end(body);
}).listen(PORT, () => console.log(`serving ${DIR} at http://localhost:${PORT}${PREFIX}/`));
