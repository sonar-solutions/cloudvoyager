#!/usr/bin/env node

/**
 * prepare-cli.js
 *
 * For local development: copies the CLI binary from dist/bin/ into desktop/resources/cli/.
 * In CI, the binary is downloaded from artifacts instead.
 *
 * Usage: node desktop/scripts/prepare-cli.js
 */

const fs = require('fs');
const path = require('path');

const PLATFORM_MAP = {
  'linux-x64': 'cloudvoyager-linux-x64',
  'linux-arm64': 'cloudvoyager-linux-arm64',
  'darwin-arm64': 'cloudvoyager-macos-arm64',
  'darwin-x64': 'cloudvoyager-macos-x64',
  'win32-x64': 'cloudvoyager-win-x64.exe',
  'win32-arm64': 'cloudvoyager-win-arm64.exe'
};

const platform = process.platform;
const arch = process.arch;
const key = `${platform}-${arch}`;
const binaryName = PLATFORM_MAP[key];

if (!binaryName) {
  console.error(`Unsupported platform: ${key}`);
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..', '..');
const srcPath = path.join(projectRoot, 'dist', 'bin', binaryName);
const destDir = path.join(projectRoot, 'desktop', 'resources', 'cli');
const destPath = path.join(destDir, binaryName);

if (!fs.existsSync(srcPath)) {
  console.log(`CLI binary not found at ${srcPath}`);
  console.log('Run "npm run package" from the project root first, or the app will fall back to running src/index.js via Node.');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcPath, destPath);

// Make executable on Unix
if (platform !== 'win32') {
  fs.chmodSync(destPath, 0o755);
}

console.log(`Copied ${binaryName} to ${destDir}`);
