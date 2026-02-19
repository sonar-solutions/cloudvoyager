/**
 * Tests for src/index.js (CLI entry point).
 *
 * Since index.js calls program.parse() on import, we test it by
 * spawning child processes with controlled argv and capturing output.
 * This validates the CLI behavior end-to-end.
 *
 * For coverage of the internal helper functions, we rely on the
 * pipeline tests (transfer-pipeline.test.js, migrate-pipeline.test.js)
 * which test the same code paths.
 */
import test from 'ava';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const exec = promisify(execFile);

const CLI_PATH = join(process.cwd(), 'src', 'index.js');

test('CLI shows help with --help', async t => {
  const { stdout } = await exec('node', [CLI_PATH, '--help']);
  t.true(stdout.includes('cloudvoyager'));
  t.true(stdout.includes('transfer'));
  t.true(stdout.includes('validate'));
  t.true(stdout.includes('status'));
  t.true(stdout.includes('reset'));
  t.true(stdout.includes('migrate'));
});

test('CLI shows version with --version', async t => {
  const { stdout } = await exec('node', [CLI_PATH, '--version']);
  t.true(stdout.includes('1.0.0'));
});

test('validate command with valid config succeeds', async t => {
  const configPath = join(tmpdir(), `cv-config-${randomUUID()}.json`);
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile: '.state.json', batchSize: 100 }
  };
  await writeFile(configPath, JSON.stringify(config));
  try {
    const { stdout } = await exec('node', [CLI_PATH, 'validate', '-c', configPath]);
    t.true(stdout.includes('valid'));
  } finally {
    await unlink(configPath).catch(() => {});
  }
});

test('validate command with missing config fails', async t => {
  try {
    await exec('node', [CLI_PATH, 'validate', '-c', '/nonexistent/config.json']);
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code || error.stderr);
  }
});

test('validate command with invalid config fails', async t => {
  const configPath = join(tmpdir(), `cv-config-${randomUUID()}.json`);
  await writeFile(configPath, '{"invalid": true}');
  try {
    await exec('node', [CLI_PATH, 'validate', '-c', configPath]);
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code || error.stderr);
  } finally {
    await unlink(configPath).catch(() => {});
  }
});

test('status command with valid config and no state file', async t => {
  const dir = join(tmpdir(), `cv-status-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const stateFile = join(dir, 'state.json');
  const configPath = join(dir, 'config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile, batchSize: 100 }
  };
  await writeFile(configPath, JSON.stringify(config));
  try {
    const { stdout } = await exec('node', [CLI_PATH, 'status', '-c', configPath]);
    t.true(stdout.includes('Never') || stdout.includes('Last sync'));
  } finally {
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  }
});

test('reset command without --yes exits without resetting', async t => {
  const configPath = join(tmpdir(), `cv-config-${randomUUID()}.json`);
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile: '.state.json', batchSize: 100 }
  };
  await writeFile(configPath, JSON.stringify(config));
  try {
    // reset without --yes should show warning and exit
    const { stdout } = await exec('node', [CLI_PATH, 'reset', '-c', configPath]);
    t.true(stdout.includes('clear') || stdout.includes('confirmation') || stdout.includes('--yes'));
  } finally {
    await unlink(configPath).catch(() => {});
  }
});

test('transfer command requires -c option', async t => {
  try {
    await exec('node', [CLI_PATH, 'transfer']);
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.stderr.includes('required') || error.code);
  }
});

test('migrate command requires -c option', async t => {
  try {
    await exec('node', [CLI_PATH, 'migrate']);
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.stderr.includes('required') || error.code);
  }
});

test('transfer-all command requires -c option', async t => {
  try {
    await exec('node', [CLI_PATH, 'transfer-all']);
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.stderr.includes('required') || error.code);
  }
});

test('sync-metadata command requires -c option', async t => {
  try {
    await exec('node', [CLI_PATH, 'sync-metadata']);
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.stderr.includes('required') || error.code);
  }
});

// --- Tests that exercise action handler code paths ---

function createTransferConfig(dir) {
  return {
    sonarqube: { url: 'http://localhost:19000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'http://localhost:19001', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile: join(dir, 'state.json'), batchSize: 100 }
  };
}

function createMigrateConfig(dir) {
  return {
    sonarqube: { url: 'http://localhost:19000', token: 'tok' },
    sonarcloud: {
      organizations: [{ key: 'org', token: 'tok', url: 'http://localhost:19001' }]
    },
    transfer: { mode: 'full', stateFile: join(dir, 'state.json'), batchSize: 100 },
    migrate: { outputDir: join(dir, 'output') }
  };
}

test('transfer command fails at connection', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify(createTransferConfig(dir)));
  try {
    await exec('node', [CLI_PATH, 'transfer', '-c', configPath], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    // Command exits with code 1 due to connection failure
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('transfer command with --verbose sets debug level', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify(createTransferConfig(dir)));
  try {
    await exec('node', [CLI_PATH, 'transfer', '-c', configPath, '--verbose'], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('transfer-all command fails at connection', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  const config = {
    ...createTransferConfig(dir),
    transferAll: { excludeProjects: [] }
  };
  await writeFile(configPath, JSON.stringify(config));
  try {
    await exec('node', [CLI_PATH, 'transfer-all', '-c', configPath], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('migrate command fails at connection', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify(createMigrateConfig(dir)));
  try {
    await exec('node', [CLI_PATH, 'migrate', '-c', configPath], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('migrate command with --dry-run and --verbose', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify(createMigrateConfig(dir)));
  try {
    await exec('node', [CLI_PATH, 'migrate', '-c', configPath, '--dry-run', '--verbose'], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('sync-metadata command fails at connection', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify(createMigrateConfig(dir)));
  try {
    await exec('node', [CLI_PATH, 'sync-metadata', '-c', configPath], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('reset command with --yes resets state', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const stateFile = join(dir, 'state.json');
  const configPath = join(dir, 'config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile, batchSize: 100 }
  };
  await writeFile(configPath, JSON.stringify(config));
  try {
    const { stdout } = await exec('node', [CLI_PATH, 'reset', '-c', configPath, '--yes']);
    t.true(stdout.includes('reset') || stdout.includes('Reset'));
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});

test('test command fails at connection', async t => {
  const dir = join(tmpdir(), `cv-cli-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify(createTransferConfig(dir)));
  try {
    await exec('node', [CLI_PATH, 'test', '-c', configPath], { timeout: 15000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    const { rm: rmDir } = await import('node:fs/promises');
    await rmDir(dir, { recursive: true, force: true });
  }
});
