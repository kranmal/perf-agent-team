#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p ~/.claude/agents ~/.claude/skills
cp "$here"/agents/perf-*.md ~/.claude/agents/
rm -rf ~/.claude/skills/perf-k6
cp -R "$here/skills/perf-k6" ~/.claude/skills/perf-k6
echo "Installed 5 agents and the perf-k6 skill into ~/.claude. Install k6 with: brew install k6"
