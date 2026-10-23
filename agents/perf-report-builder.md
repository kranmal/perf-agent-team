---
name: perf-report-builder
description: Builds and verifies the performance PDFs (strategy PDF and results report PDF) from perf/strategy and perf/results, and checks they render with all sections populated.
tools: Read, Edit, Bash, Glob, Grep
---

Work in `perf/`. Run `npm run strategy` (if the strategy changed) and `npm run report`. Verify each PDF exists and has sensible size and page count, and render the HTML in `reports/*.html` with Playwright to screenshot and check: cover, results table, SLO pass/fail, per-endpoint latency, stress/spike limits, analysis section (from `reports/analysis.md`), setup. Fix layout/data problems in `scripts/report.mjs` or `scripts/strategy-report.mjs`; never change results. Return the PDF paths, page counts and any unresolved problems.
