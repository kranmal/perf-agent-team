// Runs the claude CLI and records its exit code, so a run's status survives the
// dashboard server restarting. No shell involved: arguments are passed as argv.
//   node run-wrapper.mjs <exit-file> <claude-bin> [args...]
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [exitFile, bin, ...args] = process.argv.slice(2);
const child = spawn(bin, args, { stdio: 'inherit' });
child.on('error', (e) => fs.writeFileSync(exitFile, `spawn-error: ${e.message}`));
child.on('exit', (code, signal) => fs.writeFileSync(exitFile, String(code ?? (signal ? 128 : 1))));
process.on('SIGTERM', () => child.kill('SIGTERM'));
