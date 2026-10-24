// strategy/strategy.json -> reports/perf-strategy.pdf (+ .html). Built BEFORE any test is written.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CSS, esc, readJson, htmlToPdf } from './lib.mjs';

const s = readJson(path.join(ROOT, 'strategy/strategy.json'));
const list = (a) => `<ul>${(a || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const tbl = (head, rows) => `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
const missing = [];
for (const k of ['executiveSummary', 'findings', 'journeys', 'slos', 'testPlan']) if (!s[k] || (Array.isArray(s[k]) && !s[k].length) || (Array.isArray(s[k]) && !s[k][0].observation && !s[k][0].name && !s[k][0].metric && !s[k][0].profile)) missing.push(k);
if (missing.length) { console.error('strategy.json incomplete:', missing.join(', ')); process.exit(1); }

const html = `<!doctype html><meta charset=utf-8><title>Performance test strategy</title><style>${CSS}</style>
<div class=cover><h1>Performance test strategy</h1><div class=meta>${esc(s.project)} · ${esc(s.target)} · ${esc(s.date)} · analysed from ${esc(s.mode)}</div></div>
<div class=note><b>Status: proposal for approval.</b> No performance tests have been written or run. Answer the open questions and approve (or amend) the test plan before the build phase starts.</div>
<h2>1. Summary</h2><p>${esc(s.executiveSummary)}</p>
<h2>2. What the system is</h2>${tbl(['Aspect', 'Detail'], Object.entries(s.system).filter(([, v]) => v).map(([k, v]) => [esc(k), esc(v)]))}
<h2>3. Findings that drive the strategy</h2>${tbl(['Area', 'Observation', 'Evidence', 'Perf risk'], s.findings.map((f) => [esc(f.area), esc(f.observation), `<code>${esc(f.evidence)}</code>`, `<b class=${f.perfRisk === 'high' ? 'fail' : 'info'}>${esc(f.perfRisk)}</b>`]))}
<h2>4. User journeys to test</h2>${tbl(['Journey', 'Steps', 'Traffic share', 'Criticality', 'Endpoints'], s.journeys.map((j) => [esc(j.name), `<ol>${j.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`, esc(j.trafficShare), esc(j.criticality), j.endpoints.map((e) => `<code>${esc(e)}</code>`).join('<br>')]))}
<h2>5. Workload model</h2><p>Concurrent users: <b>${esc(s.workload.expectedConcurrentUsers)}</b> · Peak requests/s: <b>${esc(s.workload.peakRps)}</b> · Basis: ${esc(s.workload.basis)}</p>${list(s.workload.assumptions)}
<h2>6. Service level objectives (pass/fail criteria)</h2>${tbl(['Metric', 'Target', 'Rationale'], s.slos.map((x) => [esc(x.metric), esc(x.target), esc(x.rationale)]))}
<h2>7. Test plan</h2>${tbl(['Test', 'Purpose', 'Load', 'Duration', 'Pass criteria', 'Why this test'], s.testPlan.map((t) => [`<b>${esc(t.profile)}</b>`, esc(t.purpose), esc(t.load), esc(t.duration), esc(t.passCriteria), esc(t.why)]))}
<h2>8. Environment, data and safeguards</h2>${tbl(['Aspect', 'Detail'], [['Target', esc(s.environment.target)], ['Test data', esc(s.environment.dataNeeds)], ['Safeguards', list(s.environment.safeguards)], ['Monitoring', list(s.environment.monitoring)]])}
<h2>9. Tooling</h2><p><b>${esc(s.tooling.tool)}</b>: ${esc(s.tooling.why)}<br><span class=info>Alternatives considered: ${esc(s.tooling.alternatives)}</span></p>
<h2>10. Risks</h2>${tbl(['Risk', 'Mitigation'], (s.risks || []).map((r) => [esc(r.risk), esc(r.mitigation)]))}
<h2>11. Open questions for you</h2>${list(s.openQuestions)}
<h2>12. Not in scope</h2>${list(s.notInScope)}
<h2>13. What happens after approval</h2><ol><li>Scripts and <code>perf.config.json</code> are built to this plan.</li><li>Smoke test, then load, stress and spike run one at a time.</li><li>A results report PDF is produced: SLO pass/fail, latency percentiles, throughput, error rates, breaking point, bottleneck notes and recommendations.</li></ol>`;
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
const h = path.join(ROOT, 'reports/perf-strategy.html');
fs.writeFileSync(h, html);
const ok = await htmlToPdf(h, path.join(ROOT, 'reports/perf-strategy.pdf'));
console.log(ok ? 'reports/perf-strategy.pdf' : 'reports/perf-strategy.html');
