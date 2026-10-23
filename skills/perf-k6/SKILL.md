---
name: perf-k6
description: This skill should be used when the user asks to performance test, load test, stress test, spike test, soak test, benchmark, or capacity-plan a codebase or website, or asks for a performance test strategy or performance report PDF. It analyses the target, produces a strategy PDF for approval BEFORE any test is written, then builds k6 scripts, runs smoke/load/stress/spike/soak tests safely, compares to a baseline, and produces a results report PDF.
---

# Performance testing with k6

Two phases with a hard approval gate between them. **Never write scripts or run load before the user approves the strategy PDF.**

Bundled: `assets/scaffold/perf/` (skeleton, copy to `<project>/perf/`), `references/strategy-guide.md` (how to analyse and what the strategy must contain; **read before Phase 1**), `references/analysis-guide.md` (read before Phase 3 analysis).

Why k6: single binary (`brew install k6`, no JVM), scripts are JavaScript/Git-friendly, thresholds give pass/fail exit codes, good CI story. JMeter is the alternative when the user needs GUI-recorded plans, JDBC/JMS/LDAP protocols, or an existing JMX estate; say so in the strategy if relevant.

## Phase 1: Analyse and propose (no tests yet)

1. Orient: codebase (stack, routes, API handlers, DB queries, caches, queues, auth, external calls, existing config like rate limits and pool sizes) or website (pages, network calls from a browser or `curl`, static vs dynamic, third parties, CDN headers). Read `references/strategy-guide.md`.
2. For a live site: read-only, low-volume probing only (a handful of GETs, timings, headers). Never load-test a third-party or production site without the user stating they own it or have written permission.
3. Scaffold `perf/` (copy scaffold; `npm install`; `npx playwright install chromium`), then fill `perf/strategy/strategy.json` with evidence-based content: findings with `file:line` or URL, journeys, workload model (say whether numbers are measured, user-stated, or assumed), SLOs, test plan, environment and safeguards, open questions.
4. `npm run strategy` in `perf/` produces `reports/perf-strategy.pdf`. Check it renders (page count, nothing empty).
5. **Stop.** Give the user the PDF path, the open questions, and ask for approval or changes. Amend `strategy.json`, regenerate, and repeat until approved.

## Phase 2: Build, run, report (only after approval)

1. Fill `perf.config.json` from the approved strategy (baseUrl, endpoints, SLOs, targetVus, host allow-list). For multi-step flows write scenarios in `k6/scenarios/` (see its README).
2. `npm run check`, then run a dry run with `DURATION_SCALE=0.1` to validate the scripts. Fix script bugs only; never loosen an SLO to pass.
3. Run profiles one at a time, in order: `smoke` (stop if it fails), `load`, `stress`, `spike`, optionally `soak`. Never in parallel.
4. First good run: `npm run baseline:accept`. Later runs: `npm run compare` flags regressions beyond `regressionTolerance`.
5. Analyse (`references/analysis-guide.md`), write `reports/analysis.md`, then `npm run report` for `reports/perf-report-latest.pdf`.

## Safety rules
- `hostGuard` in `scripts/lib.mjs` refuses non-local hosts unless listed in `remoteHostsAllowed` with `allowRemote: true`; stress/spike/soak on remote hosts also need `ALLOW_HEAVY_REMOTE=1`. Do not bypass it. Never target production.
- No real user data, no real payments, no emails/SMS triggered. Use test accounts and a staging or local environment.
- Load generator is on the same laptop as a local target: say that results are indicative only (shared CPU), and watch for generator saturation.
- Never edit application source. Report findings; do not fix the app.
- Never present guessed numbers as measured. Mark assumptions.
