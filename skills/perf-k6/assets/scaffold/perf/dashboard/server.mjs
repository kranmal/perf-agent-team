// Local performance dashboard. Zero dependencies. Reads the perf/ folder, runs the existing npm scripts.
// Usage: node dashboard/server.mjs   (PORT=4180, PERF_DIR=<path to a perf/ folder>)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.PERF_DIR || path.join(HERE, '..'));
const PUBLIC = path.join(HERE, 'public');
const PORT = Number(process.env.PORT || 4180);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const vals = (m) => (m && (m.values || m)) || {};
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };

function summarise(file) {
  const j = readJson(path.join(ROOT, 'results', file));
  if (!j?.data?.metrics) return null;
  const m = j.data.metrics, d = vals(m.http_req_duration), thr = [];
  for (const [name, met] of Object.entries(m)) for (const [expr, r] of Object.entries(met.thresholds || {})) thr.push({ metric: name, expr, ok: !!r.ok });
  const endpoints = (j.config?.endpoints || []).map((e) => {
    const v = vals(m[`http_req_duration{endpoint:${e.name}}`]);
    const t = thr.filter((x) => x.metric === `http_req_duration{endpoint:${e.name}}`);
    return { name: e.name, path: e.path, p50: v.med, p95: v['p(95)'], p99: v['p(99)'], max: v.max, ok: t.length ? t.every((x) => x.ok) : null, threshold: t[0]?.expr };
  });
  const stamp = file.match(/-(\d{4}-\d\d-\d\dT[\d-]+Z)\.json$/)?.[1];
  return {
    file, profile: j.profile, base: j.base, gated: j.gated, at: stamp ? stamp.replace(/T(\d\d)-(\d\d)-(\d\d)-\d+Z/, 'T$1:$2:$3Z') : fs.statSync(path.join(ROOT, 'results', file)).mtime.toISOString(),
    durationS: (j.data.state?.testRunDurationMs || 0) / 1000, vusMax: vals(m.vus_max).max ?? vals(m.vus).max,
    p50: d.med, p90: d['p(90)'], p95: d['p(95)'], p99: d['p(99)'], max: d.max, avg: d.avg,
    errorRate: vals(m.http_req_failed).rate ?? 0, rps: vals(m.http_reqs).rate, requests: vals(m.http_reqs).count,
    receivedMB: (vals(m.data_received).count || 0) / 1048576, checks: vals(m.checks).rate,
    thresholds: thr, passed: thr.length ? thr.every((x) => x.ok) : null, endpoints,
  };
}

function state() {
  const cfg = readJson(path.join(ROOT, 'perf.config.json'), {});
  const strategy = readJson(path.join(ROOT, 'strategy', 'strategy.json'));
  const rdir = path.join(ROOT, 'results');
  const files = fs.existsSync(rdir) ? fs.readdirSync(rdir) : [];
  const runs = files.filter((f) => /^(smoke|load|stress|spike|soak)-\d{4}.*\.json$/.test(f)).map(summarise).filter(Boolean).sort((a, b) => b.at.localeCompare(a.at));
  const browser = {};
  for (const f of files.filter((x) => x.startsWith('browser-'))) browser[f.replace(/^browser-|\.json$/g, '')] = readJson(path.join(rdir, f));
  const pdir = path.join(ROOT, 'reports');
  const reports = fs.existsSync(pdir) ? fs.readdirSync(pdir).filter((f) => /\.(pdf|md|html)$/.test(f)).map((f) => ({ name: f, kb: Math.round(fs.statSync(path.join(pdir, f)).size / 1024), at: fs.statSync(path.join(pdir, f)).mtime.toISOString() })) : [];
  const analysis = fs.existsSync(path.join(pdir, 'analysis.md')) ? fs.readFileSync(path.join(pdir, 'analysis.md'), 'utf8') : null;
  return { project: cfg.project || path.basename(path.dirname(ROOT)), config: cfg, strategy, runs, browser, baseline: readJson(path.join(rdir, 'baseline.json')), reports, analysis, job: jobInfo() };
}

// One job at a time: concurrent load runs distort each other.
let job = null;
const clients = new Set();
const jobInfo = () => job && { id: job.id, label: job.label, startedAt: job.startedAt, endedAt: job.endedAt, code: job.code, running: job.code === undefined, log: job.log.slice(-400) };
const emit = (event, data) => { for (const c of clients) c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
const JOBS = {
  smoke: ['run.mjs', 'smoke'], load: ['run.mjs', 'load'], stress: ['run.mjs', 'stress'], spike: ['run.mjs', 'spike'], soak: ['run.mjs', 'soak'],
  browser: ['browser/run-all.mjs'], report: ['report.mjs'], strategy: ['strategy-report.mjs'], compare: ['compare.mjs'], baseline: ['compare.mjs', '--accept'], build: null,
};
function start(name, extraEnv = {}) {
  if (job && job.code === undefined) return { error: `"${job.label}" is still running` };
  if (!(name in JOBS)) return { error: 'unknown job' };
  const cmd = name === 'build' ? ['npm', ['run', 'build']] : ['node', [path.join('scripts', ...JOBS[name][0].split('/')), ...JOBS[name].slice(1)]];
  job = { id: Date.now().toString(36), label: name, startedAt: new Date().toISOString(), log: [] };
  const p = spawn(cmd[0], cmd[1], { cwd: ROOT, env: { ...process.env, ...extraEnv, FORCE_COLOR: '0' } });
  job.proc = p;
  const feed = (b) => { for (const line of b.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n|\r/)) if (line.trim()) { job.log.push(line); if (job.log.length > 2000) job.log.shift(); emit('log', line); } };
  p.stdout.on('data', feed); p.stderr.on('data', feed);
  p.on('close', (code) => { job.code = code ?? 1; job.endedAt = new Date().toISOString(); emit('done', jobInfo()); });
  p.on('error', (e) => { feed(String(e)); job.code = 1; job.endedAt = new Date().toISOString(); emit('done', jobInfo()); });
  emit('start', jobInfo());
  return { ok: true, job: jobInfo() };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  if (p === '/api/state') return send(res, 200, state());
  if (p === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': ok\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (p === '/api/run' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => (body += c));
    return req.on('end', () => {
      const { name, scale } = JSON.parse(body || '{}');
      const r = start(name, scale ? { DURATION_SCALE: String(scale) } : {});
      send(res, r.error ? 409 : 200, r);
    });
  }
  if (p === '/api/cancel' && req.method === 'POST') { if (job && job.code === undefined) job.proc.kill('SIGINT'); return send(res, 200, { ok: true }); }
  if (p.startsWith('/files/')) { // only reports/ and results/ are exposed
    const rel = p.slice(7); const full = path.resolve(ROOT, rel);
    if (!/^(reports|results)\//.test(rel) || !full.startsWith(ROOT + path.sep) || !fs.existsSync(full)) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, fs.readFileSync(full), MIME[path.extname(full)] || 'application/octet-stream');
  }
  const full = path.join(PUBLIC, p === '/' ? 'index.html' : p);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, fs.readFileSync(full), MIME[path.extname(full)] || 'application/octet-stream');
});
server.listen(PORT, '127.0.0.1', () => console.log(`Perf dashboard: http://localhost:${PORT}  (data: ${ROOT})`));
