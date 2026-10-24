#!/usr/bin/env node
// Registers the Perf Agent Team MCP server with Claude desktop.
//   node setup.mjs           print the config entry
//   node setup.mjs --write   merge it into claude_desktop_config.json (backup first)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs');
const configPath = {
  darwin: path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json'),
  win32: path.join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json'),
  linux: path.join(os.homedir(), '.config/Claude/claude_desktop_config.json'),
}[process.platform];

// GUI apps don't inherit the shell PATH, so bake in absolute paths.
let claudeBin = '';
try { claudeBin = execSync('command -v claude', { encoding: 'utf8', shell: '/bin/sh' }).trim(); } catch {}

const entry = {
  command: process.execPath,
  args: [server],
  ...(claudeBin ? { env: { PERF_UI_CLAUDE_BIN: claudeBin } } : {}),
};

if (!process.argv.includes('--write')) {
  console.log(`Add this under "mcpServers" in\n${configPath}\n`);
  console.log(JSON.stringify({ 'perf-agent-team': entry }, null, 2));
  console.log('\nOr run: node interface/setup.mjs --write');
  if (!claudeBin) console.log('\nNote: `claude` was not found on PATH; set PERF_UI_CLAUDE_BIN in "env" to its full path.');
  process.exit(0);
}

let cfg = {};
if (fs.existsSync(configPath)) {
  const raw = fs.readFileSync(configPath, 'utf8');
  try { cfg = JSON.parse(raw); } catch { console.error(`${configPath} is not valid JSON; fix it first. Nothing changed.`); process.exit(1); }
  const backup = `${configPath}.bak.${Date.now()}`;
  fs.copyFileSync(configPath, backup);
  console.log(`Backed up to ${backup}`);
} else {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}
cfg.mcpServers = { ...cfg.mcpServers, 'perf-agent-team': entry };
fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`Added "perf-agent-team" to ${configPath}\nRestart Claude desktop to load it.`);
