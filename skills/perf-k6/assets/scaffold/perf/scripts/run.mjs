// Runs one or more k6 profiles sequentially (never in parallel: they would distort each other).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, hostGuard, readJson, vals } from './lib.mjs';

const cfg = config();
const base = process.env.BASE_URL || cfg.baseUrl;
const script = process.env.SCRIPT || 'k6/main.js';
const profiles = process.argv.slice(2);
if (!profiles.length) { console.error('usage: node scripts/run.mjs <profile...>'); process.exit(2); }

let failed = false;
for (const profile of profiles) {
  hostGuard(base, cfg, profile);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join('results', `${profile}-${stamp}.json`);
  console.log(`\n=== ${profile} -> ${base} (${script}) ===`);
  const r = spawnSync('k6', ['run', '-e', `PROFILE=${profile}`, '-e', `SUMMARY_OUT=${out}`, '-e', `BASE_URL=${base}`, script], { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (!fs.existsSync(path.join(ROOT, out))) { console.error(`no summary written for ${profile}`); failed = true; continue; }
  fs.copyFileSync(path.join(ROOT, out), path.join(ROOT, 'results', `${profile}-latest.json`));
  const gated = readJson(path.join(ROOT, out)).gated;
  if (r.status !== 0 && gated) failed = true; // k6 exits 99 when a threshold fails
}
process.exit(failed ? 1 : 0);
