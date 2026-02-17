#!/usr/bin/env node

import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const BINARY_NAME = 'cloudvoyager';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const args = process.argv.slice(2);
const shouldPackage = args.includes('--package');

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

async function build() {
  const distDir = join(rootDir, 'dist');

  // Clean dist directory
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // Bundle everything into a single CJS file.
  // Proto schemas are inlined as text strings via the .proto loader.
  console.log('Bundling CLI...');
  await esbuild.build({
    entryPoints: [join(rootDir, 'src', 'index.js')],
    outfile: join(distDir, 'cli.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: [],
    loader: { '.proto': 'text' },
    define: { 'import.meta.url': 'importMetaUrl' },
    banner: {
      js: 'const importMetaUrl = require("url").pathToFileURL(__filename).href;',
    },
  });

  console.log('Bundle created: dist/cli.cjs');

  // Package as Node.js Single Executable Application (SEA)
  if (shouldPackage) {
    const platformId = detectPlatform();
    const binDir = join(distDir, 'bin');
    mkdirSync(binDir, { recursive: true });

    const seaConfig = {
      main: join(distDir, 'cli.cjs'),
      output: join(distDir, 'sea-prep.blob'),
      disableExperimentalSEAWarning: true,
    };

    // 1. Write SEA config
    const seaConfigPath = join(distDir, 'sea-config.json');
    writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

    // 2. Generate the SEA blob
    console.log('Generating SEA blob...');
    execSync(`node --experimental-sea-config ${seaConfigPath}`, {
      cwd: rootDir,
      stdio: 'inherit',
    });

    // 3. Copy the node binary
    const ext = process.platform === 'win32' ? '.exe' : '';
    const binaryPath = join(binDir, `${BINARY_NAME}-${platformId}${ext}`);
    console.log(`Copying node binary to ${BINARY_NAME}-${platformId}${ext}...`);
    copyFileSync(process.execPath, binaryPath);

    // 4. On macOS, remove the existing signature before injecting
    if (process.platform === 'darwin') {
      console.log('Removing macOS code signature...');
      execSync(`codesign --remove-signature "${binaryPath}"`, { stdio: 'inherit' });
    }

    // 5. Inject the SEA blob using postject
    console.log('Injecting SEA blob...');
    const sentinelFlag = process.platform === 'darwin'
      ? '--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA'
      : '--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
    execSync(
      `npx postject "${binaryPath}" NODE_SEA_BLOB "${seaConfig.output}" --overwrite ${sentinelFlag}`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // 6. On macOS, re-sign the binary (ad-hoc)
    if (process.platform === 'darwin') {
      console.log('Re-signing macOS binary...');
      execSync(`codesign --sign - "${binaryPath}"`, { stdio: 'inherit' });
    }

    console.log(`Binary created: dist/bin/${BINARY_NAME}-${platformId}${ext}`);
  }
}

try {
  await build();
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
