# Writing the performance strategy

## Analyse (codebase)
Look for, and cite `file:line`:
- Entry points: routes, controllers, GraphQL resolvers, cron/queue consumers.
- Expensive work per request: N+1 queries, unbounded `SELECT`, missing indexes/pagination, sync file/crypto/image work, big JSON serialisation, regex on user input.
- Shared resources: DB pool size, connection limits, single-threaded event loop blocking, locks, global caches, rate limiters, session store.
- External calls without timeouts/retries/circuit breakers; third-party APIs that must be stubbed in tests.
- Caching and static assets: headers, CDN, compression.
- Deployment limits: container CPU/memory, instance count, autoscaling.
- Existing metrics/logging that can be watched during a test.

## Analyse (website)
- Page weight, request count, render-blocking assets, caching headers, compression, HTTP version, CDN.
- Network calls the pages make (API endpoints, third parties). Test your own origin only; stub or exclude third parties.
- Dynamic vs static endpoints; auth flows; search/filters/forms (usually the heavy paths).
- A few polite timing probes (single requests) to get a latency feel. Browser-level metrics (LCP, CLS) are Lighthouse territory: mention it as a complementary check, k6 measures server/API behaviour.

## Workload model
State where each number comes from. Order of preference: production analytics/logs > user's stated figures > derived (daily users x pages/session / peak window) > assumption. Little's law: concurrent users = arrival rate x time in system (incl. think time). Default peak factor 3-5x average if unknown, labelled assumption.

## SLOs (defaults to propose, then adapt)
p95 < 800 ms, p99 < 1.5 s for APIs; p95 < 500 ms for simple reads; error rate < 1%; throughput at target load sustained; no resource growth in soak. Each needs a rationale.

## Test types: when each one earns its place
| Test | Purpose | Gate? |
|---|---|---|
| smoke | scripts work, system up, 1 VU | yes |
| load | expected peak holds SLOs | yes |
| stress | step up beyond peak to find the breaking point and failure mode | no (find limits) |
| spike | sudden surge and recovery | no |
| soak | leaks, pool exhaustion, degradation over time | yes |
Skip with a reason what does not apply (e.g. no soak for a static site).

## The strategy PDF must answer
What is it, what is risky (evidence), which journeys matter, how much load and why, what counts as pass, which tests in what order, where it runs and what could go wrong, what you need from the user.
