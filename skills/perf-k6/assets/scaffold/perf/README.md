# {{PROJECT_NAME}} performance suite (k6)

Needs k6 (`brew install k6`) and Node 20+.

```bash
npm install && npx playwright install chromium   # once (PDF rendering)
npm run check            # k6 present, target allowed
npm run strategy         # strategy/strategy.json -> reports/perf-strategy.pdf
npm run test:smoke       # then test:load, test:stress, test:spike, test:soak
npm run report           # reports/perf-report-latest.pdf
npm run baseline:accept  # record latest as baseline;  npm run compare  to check regressions
```

Quick dry run: `DURATION_SCALE=0.1 npm run test:load`. Other target: `BASE_URL=https://staging.example.com npm run test:load` (host must be in `remoteHostsAllowed`).
Safety: remote hosts are refused unless allow-listed; stress/spike/soak on remote need `ALLOW_HEAVY_REMOTE=1`. Only test systems you own, never production.
