// results/*-latest.json -> reports/perf-report-latest.pdf (+ .html)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CSS, esc, readJson, vals, htmlToPdf, config } from './lib.mjs';

const R = path.join(ROOT, 'results');
const order = ['smoke', 'load', 'stress', 'spike', 'soak'];
const runs = order.filter((p) => fs.existsSync(path.join(R, `${p}-latest.json`))).map((p) => ({ p, ...readJson(path.join(R, `${p}-latest.json`)) }));
const bjson = (n) => (fs.existsSync(path.join(R, `browser-${n}.json`)) ? readJson(path.join(R, `browser-${n}.json`)) : null);
const cold = bjson('cold-load'), scale = bjson('data-scale'), store = bjson('storage-limit');
if (!runs.length && !cold && !scale) { console.error('no results found; run a test first'); process.exit(1); }
const cfg = config();
const f = (n, d = 1) => (typeof n === 'number' ? n.toFixed(d) : '-');
const tbl = (head, rows) => `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

function sloRows(run) {
  const rows = [];
  for (const [name, m] of Object.entries(run.data.metrics)) {
    for (const [expr, t] of Object.entries(m.thresholds || {})) rows.push([esc(name), `<code>${esc(expr)}</code>`, (t.ok ?? t) === true || t.ok ? '<span class=pass>PASS</span>' : '<span class=fail>FAIL</span>']);
  }
  return rows;
}
function summaryRow(run) {
  const m = run.data.metrics, d = vals(m.http_req_duration);
  const err = vals(m.http_req_failed).rate ?? vals(m.http_req_failed).value ?? 0;
  const failedT = sloRows(run).filter((r) => r[2].includes('FAIL')).length;
  const verdict = !run.gated ? '<span class=info>informational</span>' : failedT ? '<span class=fail>FAIL</span>' : '<span class=pass>PASS</span>';
  return [`<b>${run.p}</b>`, f(vals(m.http_reqs).count, 0), f(vals(m.http_reqs).rate), f(d.avg), f(d['p(90)']), f(d['p(95)']), f(d['p(99)']), f(d.max), `${f(err * 100, 2)}%`, f(vals(m.vus_max).max ?? vals(m.vus_max).value, 0), verdict];
}
function perEndpoint(run) {
  const rows = []; const eps = cfg.endpoints.map((e) => e.name);
  for (const ep of eps) {
    const m = run.data.metrics[`http_req_duration{endpoint:${ep}}`]; if (!m) continue;
    const d = vals(m); rows.push([esc(ep), f(d.avg), f(d.med), f(d['p(95)']), f(d['p(99)']), f(d.max)]);
  }
  return rows;
}
function breakingPoint(run) {
  // Stress/spike: infer from checks and error rate only at summary level; advise using time-series if needed.
  const c = vals(run.data.metrics.checks); const rate = c.rate ?? c.value;
  return `Check pass rate ${f(rate * 100, 1)}%. ${rate < 0.95 ? 'Errors appeared under this profile: inspect the step at which failures started (see k6 console output / time series).' : 'No significant failure up to the peak load of this profile.'}`;
}

const ms = (v) => (v == null ? '-' : v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v * 10) / 10 + ' ms');
function browserHtml() {
  if (!cold && !scale && !store) return '';
  let o = '<h2>4b. Browser measurements</h2>';
  if (cold) o += '<h3>Cold load (empty cache; median)</h3>' + tbl(['Variant', 'FCP', 'LCP', 'TBT', 'CLS', 'Requests', 'Transfer', 'LCP &lt; 2.5 s, TBT &lt; 200 ms, CLS &lt; 0.1'], cold.variants.map((v) => { const s = v.summary; const ok = s.lcp.median < 2500 && s.tbt.median < 200 && s.cls.median < 0.1; return [esc(v.variant), ms(s.fcp.median), ms(s.lcp.median), ms(s.tbt.median), s.cls.median, s.requests.median, Math.round(s.ownKB.median) + ' KB', ok ? '<span class=pass>PASS</span>' : '<span class=fail>FAIL</span>']; }));
  if (scale) o += '<h3>Data scale (localStorage seeded with N loans, 30% active)</h3>' + tbl(['Profile', 'Loans', 'Startup', 'Tab switch', 'Add loan', 'Mark returned', 'Heap', 'DOM nodes', 'Add loan &lt; 100 ms'], scale.results.map((r) => { const s = r.summary, g = (k, fn = ms) => (s[k] ? fn(s[k].median) : '-'); return [esc(r.profile), r.loans.toLocaleString(), g('startupMs'), g('itemsTabMs'), g('addLoanMs'), g('markReturnedMs'), g('heapMB', (v) => v + ' MB'), g('domNodes', (v) => v.toLocaleString()), r.error ? '<span class=fail>DID NOT COMPLETE</span>' : s.addLoanMs.median < 100 ? '<span class=pass>PASS</span>' : '<span class=fail>FAIL</span>']; })) + '<p class=info>Indicative: shared laptop CPU, CPU throttling approximates a phone, dataset sizes are assumptions.</p>';
  if (store) o += `<h3>Storage limit</h3><p>localStorage accepted about ${(store.quota.acceptedChars / 1048576).toFixed(1)} M characters; a write near the limit ${store.nearLimit.persisted ? 'persisted' : 'was lost'}.</p>`;
  return o;
}
const html = `<!doctype html><meta charset=utf-8><title>Performance test report</title><style>${CSS}</style>
<div class=cover><h1>Performance test report</h1><div class=meta>${esc(cfg.project)} · ${esc(runs[0].base)} · ${new Date().toISOString().slice(0, 10)}</div></div>
<h2>1. Results at a glance</h2>
${runs.length ? tbl(['Test', 'Requests', 'Req/s', 'Avg ms', 'p90 ms', 'p95 ms', 'p99 ms', 'Max ms', 'Errors', 'Peak VUs', 'Verdict'], runs.map(summaryRow)) : '<p class=info>No k6 runs.</p>'}
<p class=info>Stress and spike tests deliberately exceed normal load; they find limits and are not pass/fail gated.</p>
<h2>2. SLO checks</h2>${runs.map((r) => `<h3>${r.p}</h3>${tbl(['Metric', 'Threshold', 'Result'], sloRows(r))}`).join('')}
<h2>3. Per-endpoint latency</h2>${runs.map((r) => `<h3>${r.p}</h3>${tbl(['Endpoint', 'Avg ms', 'Median ms', 'p95 ms', 'p99 ms', 'Max ms'], perEndpoint(r))}`).join('')}
<h2>4. Limits under stress and spike</h2>${runs.filter((r) => !r.gated).map((r) => `<h3>${r.p}</h3><p>${breakingPoint(r)}</p>`).join('') || '<p class=info>Not run.</p>'}
${browserHtml()}
<h2>5. Analysis and recommendations</h2><p class=info>Written by the analyst agent from the numbers above (bottlenecks, likely causes, fixes, re-test plan). See reports/analysis.md.</p>
${fs.existsSync(path.join(ROOT, 'reports/analysis.md')) ? `<pre style="white-space:pre-wrap;font:inherit">${esc(fs.readFileSync(path.join(ROOT, 'reports/analysis.md'), 'utf8'))}</pre>` : ''}
<h2>6. Test setup</h2><p>Tool: k6. Think time ${esc(cfg.thinkTimeSeconds)}s. Target VUs ${esc(cfg.targetVus)}. Default SLO: p95 &lt; ${esc(cfg.defaultSlo.p95Ms)} ms, p99 &lt; ${esc(cfg.defaultSlo.p99Ms)} ms, error rate &lt; ${esc(cfg.defaultSlo.errorRate * 100)}%. Raw data: <code>results/*.json</code>.</p>`;
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
const h = path.join(ROOT, 'reports/perf-report-latest.html');
fs.writeFileSync(h, html);
console.log((await htmlToPdf(h, path.join(ROOT, 'reports/perf-report-latest.pdf'))) ? 'reports/perf-report-latest.pdf' : h);
