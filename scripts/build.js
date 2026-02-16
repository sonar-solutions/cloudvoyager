#!/usr/bin/env node

import esbuild from 'esbuild';
import { cpSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BINARY_NAME = 'cloudvoyager';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const targets = {
  'linux-x64': 'node18-linux-x64',
  'linux-arm64': 'node18-linux-arm64',
  'macos-x64': 'node18-macos-x64',
  'macos-arm64': 'node18-macos-arm64',
  'win-x64': 'node18-win-x64',
};

const args = process.argv.slice(2);
const shouldPackage = args.includes('--package');
const requestedTarget = args.find(a => a.startsWith('--target='))?.split('=')[1];

async function build() {
  const distDir = join(rootDir, 'dist');

  // Clean dist directory
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // Step 1: Bundle with esbuild
  console.log('Bundling with esbuild...');
  await esbuild.build({
    entryPoints: [join(rootDir, 'src', 'index.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: join(distDir, 'cli.cjs'),
    target: 'node18',
    // Keep Node built-ins external
    external: [],
    // Handle import.meta.url in CJS output
    define: {
      'import.meta.url': 'importMetaUrl',
    },
    banner: {
      js: [
        'const importMetaUrl = require("url").pathToFileURL(__filename).href;',
      ].join('\n'),
    },
  });

  // Step 2: Copy protobuf schema files next to the bundle
  // The bundled code resolves proto files via join(__dirname, 'schema', '...')
  // Since __dirname in the CJS bundle = dist/, proto files go to dist/schema/
  console.log('Copying protobuf schemas...');
  const schemaDir = join(distDir, 'schema');
  mkdirSync(schemaDir, { recursive: true });
  cpSync(join(rootDir, 'src', 'protobuf', 'schema'), schemaDir, {
    recursive: true,
    filter: (src) => !src.endsWith('.backup'),
  });

  console.log('Bundle created: dist/cli.cjs');

  // Step 3: Package with pkg (if requested)
  if (shouldPackage) {
    const { execSync } = await import('child_process');

    let pkgTargets;
    if (requestedTarget) {
      pkgTargets = targets[requestedTarget];
      if (!pkgTargets) {
        console.error(`Unknown target: ${requestedTarget}`);
        console.error(`Available targets: ${Object.keys(targets).join(', ')}`);
        process.exit(1);
      }
    } else {
      // All platforms
      pkgTargets = Object.values(targets).join(',');
    }

    const binDir = join(distDir, 'bin');
    mkdirSync(binDir, { recursive: true });

    console.log(`Packaging binaries for: ${pkgTargets}...`);
    execSync(
      `npx pkg ${join(distDir, 'cli.cjs')} --targets ${pkgTargets} --out-path ${binDir} --config ${join(rootDir, 'package.json')}`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    // Rename binaries from package name to desired binary name
    const packageName = 'cloudvoyager';
    for (const file of readdirSync(binDir)) {
      if (file.startsWith(packageName)) {
        const newName = file.replace(packageName, BINARY_NAME);
        renameSync(join(binDir, file), join(binDir, newName));
      }
    }

    console.log(`Binaries created in: dist/bin/`);
  }
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
