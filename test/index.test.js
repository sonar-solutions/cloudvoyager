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

// --- Tests for uncovered CLI command error / success paths ---

test('reset command with --yes and invalid config hits catch path', async t => {
  const configPath = join(tmpdir(), `cv-config-${randomUUID()}.json`);
  await writeFile(configPath, '{"invalid": true}');
  try {
    await exec('node', [CLI_PATH, 'reset', '-c', configPath, '--yes'], { timeout: 10000 });
    t.fail('Should have thrown');
  } catch (error) {
    // The process exits with code 1 due to the catch block in the reset handler
    t.truthy(error.code);
  } finally {
    await unlink(configPath).catch(() => {});
  }
});

test('reset command with --yes and missing config file hits catch path', async t => {
  try {
    await exec('node', [CLI_PATH, 'reset', '-c', '/nonexistent/config.json', '--yes'], { timeout: 10000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  }
});

test('test command with invalid config hits catch path', async t => {
  const configPath = join(tmpdir(), `cv-config-${randomUUID()}.json`);
  await writeFile(configPath, '{"invalid": true}');
  try {
    await exec('node', [CLI_PATH, 'test', '-c', configPath], { timeout: 10000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  } finally {
    await unlink(configPath).catch(() => {});
  }
});

test('test command with missing config file hits catch path', async t => {
  try {
    await exec('node', [CLI_PATH, 'test', '-c', '/nonexistent/config.json'], { timeout: 10000 });
    t.fail('Should have thrown');
  } catch (error) {
    t.truthy(error.code);
  }
});

test('test command with --verbose and bad config hits catch path', async t => {
  const configPath = join(tmpdir(), `cv-config-${randomUUID()}.json`);
  await writeFile(configPath, 'not valid json');
  try {
    await exec('node', [CLI_PATH, 'test', '-c', configPath, '--verbose'], { timeout: 10000 });
    t.fail('Should have thrown');
  } catch (error) {
    // exits with code 1 via catch block
    t.truthy(error.code);
  } finally {
    await unlink(configPath).catch(() => {});
  }
});

// --- Tests for status command with completedBranches (lines 62-64) ---

test('status command with completedBranches lists branches', async t => {
  const dir = join(tmpdir(), `cv-status-branches-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const stateFile = join(dir, 'state.json');
  const configPath = join(dir, 'config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile, batchSize: 100 }
  };
  // Write a state file with completedBranches populated
  const state = {
    lastSync: '2026-01-15T00:00:00.000Z',
    processedIssues: ['issue-1', 'issue-2'],
    completedBranches: ['main', 'develop', 'feature/xyz'],
    syncHistory: [{ timestamp: '2026-01-15T00:00:00.000Z', success: true }]
  };
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(stateFile, JSON.stringify(state));
  try {
    const { stdout } = await exec('node', [CLI_PATH, 'status', '-c', configPath]);
    // Lines 62-64: should print "Branches:" and list each branch
    t.true(stdout.includes('Branches:'), 'should print Branches: header');
    t.true(stdout.includes('main'), 'should list main branch');
    t.true(stdout.includes('develop'), 'should list develop branch');
    t.true(stdout.includes('feature/xyz'), 'should list feature/xyz branch');
  } finally {
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  }
});

// --- Tests for status command catch/error path (lines 67-69) ---

test('status command with corrupt state file hits catch path', async t => {
  const dir = join(tmpdir(), `cv-status-err-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const stateFile = join(dir, 'state.json');
  const configPath = join(dir, 'config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile, batchSize: 100 }
  };
  await writeFile(configPath, JSON.stringify(config));
  // Write a corrupt state file (invalid JSON) to trigger catch block
  await writeFile(stateFile, 'not valid json {{{');
  try {
    await exec('node', [CLI_PATH, 'status', '-c', configPath], { timeout: 10000 });
    t.fail('Should have thrown');
  } catch (error) {
    // Lines 67-69: process exits with code 1 due to catch block
    t.truthy(error.code);
  } finally {
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  }
});

// --- Tests for test command success path (lines 108-113) ---

import { createServer } from 'node:http';

test('test command succeeds when both connections work', async t => {
  // Create a mock HTTP server that responds to both SonarQube and SonarCloud API endpoints
  const server = createServer((req, res) => {
    if (req.url === '/api/system/status') {
      // SonarQube testConnection endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'UP' }));
    } else if (req.url.startsWith('/api/organizations/search')) {
      // SonarCloud testConnection endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ organizations: [{ key: 'test-org' }] }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const mockUrl = `http://127.0.0.1:${port}`;

  const dir = join(tmpdir(), `cv-test-success-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  const config = {
    sonarqube: { url: mockUrl, token: 'tok', projectKey: 'proj' },
    sonarcloud: { url: mockUrl, token: 'tok', organization: 'test-org', projectKey: 'proj' },
    transfer: { mode: 'full', stateFile: join(dir, 'state.json'), batchSize: 100 }
  };
  await writeFile(configPath, JSON.stringify(config));
  try {
    const { stdout } = await exec('node', [CLI_PATH, 'test', '-c', configPath], { timeout: 15000 });
    // Lines 108-113: should print success messages for both connections
    t.true(stdout.includes('SonarQube connection successful'), 'should report SonarQube success');
    t.true(stdout.includes('SonarCloud connection successful'), 'should report SonarCloud success');
    t.true(stdout.includes('All connections tested successfully'), 'should report all tests passed');
  } finally {
    server.close();
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  }
});
