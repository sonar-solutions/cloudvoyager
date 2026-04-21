#!/usr/bin/env node

import { mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const BINARY_NAME = 'cloudvoyager';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const args = process.argv.slice(2);
const shouldPackage = args.includes('--package');
const useBun = args.includes('--bun');
const crossCompile = args.includes('--cross');
const targetArg = args.find(a => a.startsWith('--target='));
const targetPlatform = targetArg ? targetArg.split('=')[1] : null;

// Node.js SEA packaging requires v20. v22+ embeds the sentinel twice, causing postject to fail.
if (shouldPackage && !useBun) {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (major !== 20) {
    console.error(`\nError: Node.js v20 is required for \`npm run package\` (Node.js SEA).`);
    console.error(`  Current version: v${process.versions.node}`);
    console.error(`  Node v22+ causes postject to fail with "Multiple occurrences of sentinel".`);
    console.error(`\n  Fix: nvm install 20 && nvm use 20 && npm run package\n`);
    process.exit(1);
  }
}

// Bun target mapping: our platform ID → Bun's --target value (experimental)
// Note: win-arm64 is NOT supported by Bun and is built via Node.js SEA instead.
const BUN_TARGETS = {
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
  'macos-arm64': 'bun-darwin-arm64',
  'macos-x64': 'bun-darwin-x64',
  'win-x64': 'bun-windows-x64',
};

/**
 * Detect the current platform identifier (e.g. "macos-arm64", "linux-x64").
 */
function detectPlatform() {
  const platform = { darwin: 'macos', linux: 'linux', win32: 'win' }[process.platform];
  const arch = { x64: 'x64', arm64: 'arm64' }[process.arch];
  if (!platform || !arch) {
    console.error(`Unsupported platform: ${process.platform}-${process.arch}`);
    process.exit(1);
  }
  return `${platform}-${arch}`;
}

/**
 * Build a Bun-compiled binary for a given platform (experimental).
 * Uses the output directory as cwd so Bun's temp files and the final
 * binary are in the same directory (avoids cross-device rename errors).
 */
function bunCompile(sourceFile, outDir, binaryName, target) {
  const targetFlag = target ? `--target=${target}` : '';
  execSync(
    `npx bun build --compile ${targetFlag} --loader .proto:text "${sourceFile}" --outfile "${binaryName}"`,
    { cwd: outDir, stdio: 'inherit' }
  );
}

/**
 * Bundle with esbuild into dist/cli.cjs.
 */
async function esbuildBundle(entryPoint, distDir) {
  const esbuild = await import('esbuild');
  const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile: join(distDir, 'cli.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node21',
    external: [],
    minify: true,
    treeShaking: true,
    loader: { '.proto': 'text' },
    define: { 'import.meta.url': 'importMetaUrl', '__APP_VERSION__': JSON.stringify(version) },
    banner: {
      js: 'const importMetaUrl = require("url").pathToFileURL(__filename).href;',
    },
  });
}

/**
 * Download a Node.js binary for a different architecture (cross-compile SEA).
 * Returns the path to the downloaded node executable.
 */
function downloadNodeBinary(targetPlatformId, distDir) {
  const nodeVersion = process.versions.node;
  const nodeArchMap = { 'macos-x64': 'darwin-x64', 'macos-arm64': 'darwin-arm64', 'linux-x64': 'linux-x64', 'linux-arm64': 'linux-arm64' };
  const nodeTarget = nodeArchMap[targetPlatformId];
  if (!nodeTarget) {
    console.error(`Cross-compile SEA not supported for target: ${targetPlatformId}`);
    process.exit(1);
  }

  const tarball = `node-v${nodeVersion}-${nodeTarget}.tar.gz`;
  const url = `https://nodejs.org/dist/v${nodeVersion}/${tarball}`;
  const downloadDir = join(distDir, 'node-cross');
  mkdirSync(downloadDir, { recursive: true });

  console.log(`Downloading Node.js v${nodeVersion} for ${nodeTarget}...`);
  execSync(`curl -fsSL "${url}" | tar xz -C "${downloadDir}" --strip-components=1`, { stdio: 'inherit' });

  return join(downloadDir, 'bin', 'node');
}

/**
 * Build a Node.js SEA binary for the current (or target) platform.
 * Requires: dist/cli.cjs to already exist.
 * Pass overridePlatform (e.g. "macos-x64") to cross-compile.
 */
function seaPackage(distDir, binDir, overridePlatform) {
  const platformId = overridePlatform || detectPlatform();
  const isCross = overridePlatform && overridePlatform !== detectPlatform();
  mkdirSync(binDir, { recursive: true });

  const seaConfig = {
    main: join(distDir, 'cli.cjs'),
    output: join(distDir, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    useCodeCache: true,
  };

  const seaConfigPath = join(distDir, 'sea-config.json');
  writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  console.log('Generating SEA blob...');
  execSync(`node --experimental-sea-config "${seaConfigPath}"`, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  const targetIsWin = platformId.startsWith('win');
  const targetIsMac = platformId.startsWith('macos');
  const ext = targetIsWin ? '.exe' : '';
  const binaryPath = join(binDir, `${BINARY_NAME}-${platformId}${ext}`);

  if (isCross) {
    const nodeBin = downloadNodeBinary(platformId, distDir);
    console.log(`Copying cross-platform node binary to ${BINARY_NAME}-${platformId}${ext}...`);
    copyFileSync(nodeBin, binaryPath);
  } else {
    console.log(`Copying node binary to ${BINARY_NAME}-${platformId}${ext}...`);
    copyFileSync(process.execPath, binaryPath);
  }

  if (targetIsMac || process.platform === 'darwin') {
    console.log('Removing macOS code signature...');
    execSync(`codesign --remove-signature "${binaryPath}"`, { stdio: 'inherit' });
  }

  console.log('Injecting SEA blob...');
  const sentinelFlag = targetIsMac
    ? '--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA'
    : '--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
  execSync(
    `npx postject "${binaryPath}" NODE_SEA_BLOB "${seaConfig.output}" --overwrite ${sentinelFlag}`,
    { cwd: rootDir, stdio: 'inherit' }
  );

  if (targetIsMac || process.platform === 'darwin') {
    console.log('Re-signing macOS binary...');
    execSync(`codesign --sign - "${binaryPath}"`, { stdio: 'inherit' });
  }

  return `${BINARY_NAME}-${platformId}${ext}`;
}

async function build() {
  const distDir = join(rootDir, 'dist');
  const binDir = join(distDir, 'bin');
  const entryPoint = join(rootDir, 'src', 'index.js');

  // Clean dist directory
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // --- Bun compile (experimental): source → binary in one step ---
  if (useBun) {
    mkdirSync(binDir, { recursive: true });

    if (crossCompile) {
      // Build 5 platforms with Bun cross-compilation
      console.log('Cross-compiling for all platforms with Bun...\n');
      for (const [platformId, bunTarget] of Object.entries(BUN_TARGETS)) {
        const ext = platformId.startsWith('win') ? '.exe' : '';
        const binaryName = `${BINARY_NAME}-${platformId}${ext}`;
        console.log(`  Building ${binaryName}...`);
        bunCompile(entryPoint, binDir, binaryName, bunTarget);
      }
      console.log('');

      // Build win-arm64 via Node.js SEA (Bun doesn't support this target)
      const isWinArm64 = process.platform === 'win32' && process.arch === 'arm64';
      if (isWinArm64) {
        console.log('Building win-arm64 via Node.js SEA...');
        await esbuildBundle(entryPoint, distDir);
        const name = seaPackage(distDir, binDir);
        console.log(`  Built ${name} (via SEA)`);
      } else {
        console.log('Note: win-arm64 binary requires a Windows ARM64 machine (built via Node.js SEA).');
        console.log('      In CI, this is handled by a dedicated windows-11-arm runner.');
      }

      console.log(`\nAll binaries created in dist/bin/`);
    } else {
      // Build for current platform only
      const platformId = detectPlatform();
      const ext = process.platform === 'win32' ? '.exe' : '';
      const binaryName = `${BINARY_NAME}-${platformId}${ext}`;
      console.log('Compiling with Bun...');
      bunCompile(entryPoint, binDir, binaryName);
      console.log(`Binary created: dist/bin/${binaryName}`);
    }

    return;
  }

  // --- Default: esbuild bundle + Node.js SEA ---
  if (shouldPackage) {
    console.log('Bundling CLI with esbuild...');
    await esbuildBundle(entryPoint, distDir);
    console.log('Bundle created: dist/cli.cjs');

    const name = seaPackage(distDir, binDir, targetPlatform);
    console.log(`Binary created: dist/bin/${name}`);
    return;
  }

  // --- Bundle only (no binary) ---
  console.log('Bundling CLI with esbuild...');
  await esbuildBundle(entryPoint, distDir);
  console.log('Bundle created: dist/cli.cjs');
}

try {
  await build();
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
