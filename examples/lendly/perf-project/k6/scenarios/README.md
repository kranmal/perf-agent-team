# Custom scenarios

`k6/main.js` hits the endpoints in `perf.config.json`. For multi-step flows (login, add to basket, checkout),
copy `k6/main.js` to `k6/scenarios/<name>.js`, keep `options`, `handleSummary` and the tag conventions
(`tags: { endpoint: '<name>' }` on every request, a `Trend` named `ttfb_<name>`), and replace `journey()` with the flow.
Run it with `SCRIPT=k6/scenarios/<name>.js npm run test:load`.
Fix import paths (`../lib/profiles.js`, `../../perf.config.json`) after copying.
