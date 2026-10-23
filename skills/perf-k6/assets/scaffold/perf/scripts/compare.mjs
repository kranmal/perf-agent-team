// Compares latest results to results/baseline.json. `--accept` records latest as the new baseline.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, readJson, vals } from './lib.mjs';

const R = path.join(ROOT, 'results');
export function snapshot(file) {
  const j = readJson(file); const m = j.data.metrics;
  return {
    p95: vals(m.http_req_duration)['p(95)'], p99: vals(m.http_req_duration)['p(99)'],
    errorRate: vals(m.http_req_failed).rate ?? vals(m.http_req_failed).value ?? 0,
    rps: vals(m.http_reqs).rate,
  };
}
const profiles = ['smoke', 'load', 'stress', 'spike', 'soak'].filter((p) => fs.existsSync(path.join(R, `${p}-latest.json`)));
const latest = Object.fromEntries(profiles.map((p) => [p, snapshot(path.join(R, `${p}-latest.json`))]));

if (process.argv.includes('--accept')) {
  fs.writeFileSync(path.join(R, 'baseline.json'), JSON.stringify({ at: new Date().toISOString(), latest }, null, 2));
  console.log('baseline recorded for', profiles.join(', ')); process.exit(0);
}
const bp = path.join(R, 'baseline.json');
if (!fs.existsSync(bp)) { console.log('no baseline yet; run npm run baseline:accept after a good run'); process.exit(0); }
const base = readJson(bp).latest; const tol = config().regressionTolerance; let bad = 0;
for (const p of profiles) {
  const b = base[p], l = latest[p]; if (!b) continue;
  const dp = ((l.p95 - b.p95) / b.p95) * 100, dr = ((b.rps - l.rps) / b.rps) * 100, de = l.errorRate - b.errorRate;
  const flags = [dp > tol.p95Pct && `p95 +${dp.toFixed(1)}%`, dr > tol.rpsPct && `throughput -${dr.toFixed(1)}%`, de > tol.errorRateAbs && `errors +${(de * 100).toFixed(2)}pp`].filter(Boolean);
  console.log(`${p}: ${flags.length ? 'REGRESSION ' + flags.join(', ') : 'ok'}`); if (flags.length) bad++;
}
process.exit(bad ? 1 : 0);
