#!/usr/bin/env bash
# Run CloudVoyager Desktop locally (dev mode)
# Usage: ./.debugging/run-desktop.sh [--dev]
#   --dev  Opens DevTools on launch

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP_DIR="$PROJECT_ROOT/desktop"

# ELECTRON_RUN_AS_NODE must be unset or Electron runs as plain Node.js
unset ELECTRON_RUN_AS_NODE

cd "$DESKTOP_DIR"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "Installing desktop dependencies..."
  npm install
fi

# Pass --dev flag through to open DevTools
if [[ "${1:-}" == "--dev" ]]; then
  echo "Starting CloudVoyager Desktop (dev mode with DevTools)..."
  npx electron . --dev
else
  echo "Starting CloudVoyager Desktop..."
  npx electron .
fi
