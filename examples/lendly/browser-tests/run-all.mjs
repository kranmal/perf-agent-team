import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const d = path.dirname(fileURLToPath(import.meta.url));
for (const s of ['cold-load', 'data-scale', 'storage-limit']) {
  console.log('==', s);
  const r = spawnSync('node', [path.join(d, s + '.mjs')], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
