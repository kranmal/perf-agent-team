# Control Center

A local dashboard and MCP server for the performance agent team, in the same style as the QA Agent Team Control Center. Claude desktop can start runs, follow them and fetch the reports from chat, and the dashboard shows which agents are working.

It runs the real agent: each run launches `claude --agent perf-lead -p "..."` in the target project as a detached process, so it survives the server restarting. State is kept in `~/.perf-agent-team-ui/`.

## Two phases, one approval

| Mode | What it does |
|---|---|
| **1 · Strategy** (default) | Analyses the target and writes the strategy PDF, then stops. Nothing is run. Open questions are listed in the dashboard. |
| **2 · Build & run** | Starts only after you approve the strategy. Builds the k6 scripts, runs smoke, load, stress and spike, writes the analysis and the results report PDF. |

The dashboard asks for confirmation before starting phase 2. `hostGuard` still applies: remote hosts need an allow-list entry, and heavy profiles on remote hosts need `ALLOW_HEAVY_REMOTE=1`, which the Control Center never sets.

## Requirements

- Agents installed (`./install.sh` from the repo root) and `k6` (`brew install k6`)
- Claude Code CLI on this machine, signed in
- Node.js 18+. Nothing to `npm install`.

## Use it

```bash
node interface/server.mjs --web      # dashboard only: http://127.0.0.1:4748
node interface/setup.mjs --write     # register the MCP server with Claude desktop (backs up the config first)
```

MCP tools: `perf_run`, `perf_status`, `perf_list_runs`, `perf_cancel`, `perf_reports`, `perf_open_dashboard`.

## Settings

Runs default to Sonnet at low effort (Model, Effort and Max budget are in Run settings).

| Variable | Default |
|---|---|
| `PERF_UI_ALLOWED_TOOLS` | `Bash,Read,Write,Edit,Glob,Grep,Agent,Skill` |
| `PERF_UI_PERMISSION_MODE` | `acceptEdits` |
| `PERF_UI_PORT` | `4748` |
| `PERF_UI_CLAUDE_BIN` | auto-detected |
| `PERF_UI_STATE_DIR` | `~/.perf-agent-team-ui` |

Runs are headless, so agents can run shell commands in the target project without asking. Only point it at projects you are happy for that to happen in.

The dashboard listens on 127.0.0.1 only, rejects other Host and Origin headers, requires a custom header on every POST, and serves only files under the project's `perf/reports`, `perf/results` and `perf/strategy`.
