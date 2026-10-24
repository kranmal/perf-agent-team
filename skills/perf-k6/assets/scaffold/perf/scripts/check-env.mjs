import { execSync } from 'node:child_process';
import { config, hostGuard } from './lib.mjs';
try { console.log(execSync('k6 version').toString().trim()); }
catch { console.error('k6 not found. macOS: brew install k6'); process.exit(1); }
const cfg = config();
hostGuard(process.env.BASE_URL || cfg.baseUrl, cfg, 'smoke');
console.log('target OK:', process.env.BASE_URL || cfg.baseUrl);
