# Analysing results

1. Smoke failed: fix the script/target before anything else.
2. Compare p50/p95/p99: a big p99/p95 gap means tail latency (GC, locks, cold cache, queueing).
3. Latency rises with VUs while req/s plateaus: saturation. The plateau is the capacity; note the VU count where p95 crossed the SLO.
4. Errors: group by status (timeouts, 429 = rate limiter, 5xx = app, connection refused = limits). Note when they started in the stress ramp.
5. Per-endpoint table: one slow endpoint is a code/query problem; all slow is a resource problem.
6. Check the load generator was not the bottleneck (k6 CPU, `dropped_iterations`).
7. Compare with baseline; list regressions.
8. Soak: latency or error trend upward over time, memory growth on the target.
Write `reports/analysis.md`: headline verdict, capacity estimate (with caveats), top 3 bottlenecks with evidence, recommended fixes ranked by impact, what to re-test. Do not claim a cause you did not evidence; say "likely" and how to confirm.
