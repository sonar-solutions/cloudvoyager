#!/usr/bin/env bash
# Build/compile CloudVoyager Desktop for distribution
# Usage: ./.debugging/build-desktop.sh [platform]
#
# Platforms:
#   mac-arm64    macOS Apple Silicon (default on ARM Macs)
#   mac-x64      macOS Intel
#   linux-x64    Linux x64
#   linux-arm64  Linux ARM64
#   win-x64      Windows x64
#   win-arm64    Windows ARM64
#   all          Build for all platforms
#
# Output: desktop/dist/

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP_DIR="$PROJECT_ROOT/desktop"

cd "$DESKTOP_DIR"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "Installing desktop dependencies..."
  npm install
fi

# Detect platform default
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  DEFAULT_PLATFORM="mac-arm64"
elif [[ "$ARCH" == "x86_64" ]]; then
  DEFAULT_PLATFORM="mac-x64"
else
  DEFAULT_PLATFORM="linux-x64"
fi

PLATFORM="${1:-$DEFAULT_PLATFORM}"

build_platform() {
  local p="$1"
  echo "Building for $p..."
  npm run "build:$p"
  echo "Build complete for $p. Output in desktop/dist/"
}

if [[ "$PLATFORM" == "all" ]]; then
  for p in mac-arm64 mac-x64 linux-x64 linux-arm64 win-x64 win-arm64; do
    build_platform "$p"
  done
else
  build_platform "$PLATFORM"
fi

echo ""
echo "Build artifacts:"
ls -lh dist/ 2>/dev/null || echo "  (check desktop/dist/ for output)"
