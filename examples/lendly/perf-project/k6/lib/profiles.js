// Turns a profile name from perf.config.json into k6 scenario options.
// Stages/durations may be scaled for quick dry runs with DURATION_SCALE (e.g. 0.1).
const SCALE = parseFloat(__ENV.DURATION_SCALE || '1');

function secs(d) {
  const m = /^(\d+(?:\.\d+)?)(s|m|h)$/.exec(d);
  if (!m) throw new Error(`bad duration "${d}"`);
  return parseFloat(m[1]) * { s: 1, m: 60, h: 3600 }[m[2]];
}
function dur(d) {
  return `${Math.max(1, Math.round(secs(d) * SCALE))}s`;
}
const vus = (cfg, f) => Math.max(1, Math.round(cfg.targetVus * f));

export function buildScenario(profile, cfg) {
  const p = cfg.profiles[profile];
  if (!p) throw new Error(`unknown profile "${profile}"`);
  const common = { exec: 'journey' };

  if (profile === 'smoke') {
    return { ...common, executor: 'constant-vus', vus: p.vus, duration: dur(p.duration) };
  }
  if (profile === 'load' || profile === 'soak') {
    const t = vus(cfg, p.vusFactor);
    return {
      ...common,
      executor: 'ramping-vus',
      startVUs: 0,
      gracefulRampDown: '30s',
      stages: [
        { duration: dur(p.rampUp), target: t },
        { duration: dur(p.hold), target: t },
        { duration: dur(p.rampDown), target: 0 },
      ],
    };
  }
  if (profile === 'stress') {
    const stages = [];
    for (const s of p.steps) {
      stages.push({ duration: dur('30s'), target: vus(cfg, s) });
      stages.push({ duration: dur(p.stepDuration), target: vus(cfg, s) });
    }
    stages.push({ duration: dur(p.cooldown), target: 0 });
    return { ...common, executor: 'ramping-vus', startVUs: 0, gracefulRampDown: '30s', stages };
  }
  if (profile === 'spike') {
    return {
      ...common,
      executor: 'ramping-vus',
      startVUs: 0,
      gracefulRampDown: '30s',
      stages: [
        { duration: dur('30s'), target: vus(cfg, p.baselineFactor) },
        { duration: dur('10s'), target: vus(cfg, p.spikeFactor) },
        { duration: dur(p.spikeHold), target: vus(cfg, p.spikeFactor) },
        { duration: dur('10s'), target: vus(cfg, p.baselineFactor) },
        { duration: dur(p.recoverHold), target: vus(cfg, p.baselineFactor) },
        { duration: dur('20s'), target: 0 },
      ],
    };
  }
  throw new Error(`no builder for profile "${profile}"`);
}

// Stress and spike are expected to push past the SLO; they report breaking points rather than gate on them.
export const GATED = { smoke: true, load: true, soak: true, stress: false, spike: false };
