# Performance testing agent team

Five Claude Code agents (in `~/.claude/agents/`) using the `perf-k6` skill (`~/.claude/skills/perf-k6/`) and k6 (`brew install k6`).

## Two phases, with an approval gate

1. **Strategy (no tests written).** `perf-lead` reads the codebase or website via `perf-analyst`, then produces `perf/reports/perf-strategy.pdf`: findings with evidence, user journeys, workload model, SLOs, test plan, environment and safeguards, open questions. It stops and waits for your approval.
2. **Build, run, report (only after approval).** `perf-script-writer` builds k6 scenarios, `perf-test-runner` runs smoke, load, stress, spike (and soak) one at a time, `perf-report-builder` produces `perf/reports/perf-report-latest.pdf` (SLO pass/fail, latency percentiles, per-endpoint table, limits under stress, analysis, recommendations).

| Agent | Job |
|---|---|
| `perf-lead` | Orchestrates, owns the approval gate |
| `perf-analyst` | Read-only analysis, evidence-cited findings |
| `perf-script-writer` | Multi-step k6 scenarios |
| `perf-test-runner` | Runs profiles sequentially, flags generator saturation |
| `perf-report-builder` | Strategy and results PDFs |

## Use

```bash
cd /path/to/project
claude --agent perf-lead
```
Example: `Performance test this project. App runs at http://localhost:3000.` or `Strategy for https://mysite.com, I own it, read-only probing only.`

## Safety
Remote hosts are refused unless allow-listed in `perf.config.json`; stress/spike/soak on remote also need `ALLOW_HEAVY_REMOTE=1`. Never production, never third-party sites, no real user data.

## Running without Claude
See `perf/README.md` after the scaffold is created (`npm run test:load`, `npm run report`, `npm run compare`).

## What is in this folder

| Path | What |
|---|---|
| `agents/` | The five agent definitions (copy to `~/.claude/agents/`) |
| `skills/perf-k6/` | The skill, its guides, and the `perf/` scaffold (k6 config, runners, PDF builders, dashboard) |
| `examples/lendly/` | A complete worked example: strategy PDF, results PDF, analysis, raw results, and the Playwright browser tests used for a client-only app |
| `install.sh` | Copies agents and skill into `~/.claude/` |

## Install

```bash
./install.sh          # then: brew install k6
```

## Dashboard

Every scaffolded `perf/` includes a local dashboard (no dependencies):

```bash
cd perf && npm run dashboard     # http://localhost:4180
```

Overview with SLO verdict, load runs and trends, browser measurements, the strategy, reports, and a Run tab that starts smoke, load, stress, spike, browser tests, compare, baseline and PDF build with a live console.

## Browser tests (client-only apps)

For apps with no backend, k6 only checks static delivery. The real risk is in the browser, so `examples/lendly/browser-tests/` shows Playwright scripts for cold load (LCP, TBT, CLS under CPU and network throttling), data-scale (seed storage with N records, time interactions) and storage-limit probing. Copy and adapt the selectors for your app.
