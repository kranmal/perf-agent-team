// Generic journey driven by perf.config.json. For real user flows (login, checkout, ...)
// copy this file to k6/scenarios/<name>.js (see k6/scenarios/README.md) and run with SCRIPT=.
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { buildScenario, GATED } from './lib/profiles.js';

const cfg = JSON.parse(open('../perf.config.json'));
const PROFILE = __ENV.PROFILE || 'smoke';
const BASE = (__ENV.BASE_URL || cfg.baseUrl).replace(/\/$/, '');
const OUT = __ENV.SUMMARY_OUT || `results/${PROFILE}-latest.json`;

const ttfb = {};
for (const e of cfg.endpoints) ttfb[e.name] = new Trend(`ttfb_${e.name}`, true);

const thresholds = {};
const gate = GATED[PROFILE] !== false;
const d = cfg.defaultSlo;
thresholds['http_req_failed'] = [{ threshold: `rate<${d.errorRate}`, abortOnFail: false }];
thresholds['http_req_duration'] = [`p(95)<${d.p95Ms}`, `p(99)<${d.p99Ms}`];
for (const e of cfg.endpoints) {
  const s = { ...d, ...(e.slo || {}) };
  thresholds[`http_req_duration{endpoint:${e.name}}`] = [`p(95)<${s.p95Ms}`];
}

export const options = {
  scenarios: { [PROFILE]: buildScenario(PROFILE, cfg) },
  // Non-gated profiles (stress/spike) still record thresholds as informational; the runner decides pass/fail.
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { profile: PROFILE, gated: String(gate) },
};

const pool = cfg.endpoints.flatMap((e) => Array(Math.max(1, e.weight || 1)).fill(e));

function call(e) {
  const url = `${BASE}${e.path}`;
  const params = {
    headers: { ...(cfg.headers || {}), ...(e.headers || {}) },
    tags: { endpoint: e.name },
  };
  const body = e.body === undefined ? null : typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
  if (body && !params.headers['Content-Type']) params.headers['Content-Type'] = 'application/json';
  const res = http.request(e.method || 'GET', url, body, params);
  ttfb[e.name].add(res.timings.waiting);
  check(res, { [`${e.name} status ${e.expectStatus || 200}`]: (r) => r.status === (e.expectStatus || 200) });
  return res;
}

export function journey() {
  const e = pool[Math.floor(Math.random() * pool.length)];
  group(e.name, () => call(e));
  sleep(cfg.thinkTimeSeconds);
}

export function handleSummary(data) {
  return { [OUT]: JSON.stringify({ profile: PROFILE, base: BASE, gated: gate, config: cfg, data }, null, 2) };
}
