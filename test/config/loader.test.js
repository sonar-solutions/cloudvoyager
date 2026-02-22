import test from 'ava';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  loadConfig,
  loadMigrateConfig,
  requireProjectKeys,
  validateConfig
} from '../../src/config/loader.js';
import { ConfigurationError, ValidationError } from '../../src/utils/errors.js';

function getTmpDir() {
  return join(tmpdir(), `cloudvoyager-test-${randomUUID()}`);
}

async function writeConfig(dir, filename, data) {
  await mkdir(dir, { recursive: true });
  const path = join(dir, filename);
  await writeFile(path, JSON.stringify(data), 'utf-8');
  return path;
}

const validConfig = {
  sonarqube: { url: 'http://localhost:9000', token: 'sqp_test' },
  sonarcloud: { token: 'sc_test', organization: 'org-test' }
};

const validMigrateConfig = {
  sonarqube: { url: 'http://localhost:9000', token: 'sqp_test' },
  sonarcloud: {
    organizations: [
      { key: 'org1', token: 'token1' }
    ]
  }
};

// loadConfig
test('loadConfig loads valid config', async t => {
  const dir = getTmpDir();
  const path = await writeConfig(dir, 'config.json', validConfig);
  const config = await loadConfig(path);
  t.is(config.sonarqube.url, 'http://localhost:9000');
  t.is(config.sonarqube.token, 'sqp_test');
  t.is(config.sonarcloud.token, 'sc_test');
  t.is(config.sonarcloud.organization, 'org-test');
  t.is(config.sonarcloud.url, 'https://sonarcloud.io'); // default
  t.is(config.transfer.mode, 'incremental'); // default
  t.is(config.transfer.stateFile, './.cloudvoyager-state.json'); // default
  t.is(config.transfer.batchSize, 100); // default
  await rm(dir, { recursive: true });
});

test('loadConfig with full transfer settings', async t => {
  const dir = getTmpDir();
  const cfg = {
    ...validConfig,
    transfer: { mode: 'full', stateFile: './state.json', batchSize: 50 }
  };
  const path = await writeConfig(dir, 'config.json', cfg);
  const config = await loadConfig(path);
  t.is(config.transfer.mode, 'full');
  t.is(config.transfer.stateFile, './state.json');
  t.is(config.transfer.batchSize, 50);
  await rm(dir, { recursive: true });
});

test('loadConfig throws ConfigurationError for missing file', async t => {
  await t.throwsAsync(
    () => loadConfig('/nonexistent/config.json'),
    { instanceOf: ConfigurationError, message: /not found/ }
  );
});

test('loadConfig throws ConfigurationError for invalid JSON', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'bad.json');
  await writeFile(path, 'not json{{{', 'utf-8');
  await t.throwsAsync(
    () => loadConfig(path),
    { instanceOf: ConfigurationError, message: /Invalid JSON/ }
  );
  await rm(dir, { recursive: true });
});

test('loadConfig throws ValidationError for invalid schema', async t => {
  const dir = getTmpDir();
  const path = await writeConfig(dir, 'config.json', { sonarqube: {} });
  await t.throwsAsync(
    () => loadConfig(path),
    { instanceOf: ValidationError }
  );
  await rm(dir, { recursive: true });
});

test.serial('loadConfig applies environment variable overrides', async t => {
  const dir = getTmpDir();
  const path = await writeConfig(dir, 'config.json', validConfig);

  const origSqToken = process.env.SONARQUBE_TOKEN;
  const origScToken = process.env.SONARCLOUD_TOKEN;
  const origSqUrl = process.env.SONARQUBE_URL;
  const origScUrl = process.env.SONARCLOUD_URL;

  process.env.SONARQUBE_TOKEN = 'env_sq_token';
  process.env.SONARCLOUD_TOKEN = 'env_sc_token';
  process.env.SONARQUBE_URL = 'http://env-sq:9000';
  process.env.SONARCLOUD_URL = 'http://env-sc:9000';

  try {
    const config = await loadConfig(path);
    t.is(config.sonarqube.token, 'env_sq_token');
    t.is(config.sonarcloud.token, 'env_sc_token');
    t.is(config.sonarqube.url, 'http://env-sq:9000');
    t.is(config.sonarcloud.url, 'http://env-sc:9000');
  } finally {
    if (origSqToken === undefined) delete process.env.SONARQUBE_TOKEN;
    else process.env.SONARQUBE_TOKEN = origSqToken;
    if (origScToken === undefined) delete process.env.SONARCLOUD_TOKEN;
    else process.env.SONARCLOUD_TOKEN = origScToken;
    if (origSqUrl === undefined) delete process.env.SONARQUBE_URL;
    else process.env.SONARQUBE_URL = origSqUrl;
    if (origScUrl === undefined) delete process.env.SONARCLOUD_URL;
    else process.env.SONARCLOUD_URL = origScUrl;
  }
  await rm(dir, { recursive: true });
});

// requireProjectKeys
test('requireProjectKeys passes with both keys', t => {
  t.notThrows(() => requireProjectKeys({
    sonarqube: { projectKey: 'sq-key' },
    sonarcloud: { projectKey: 'sc-key' }
  }));
});

test('requireProjectKeys throws when sonarqube.projectKey missing', t => {
  t.throws(
    () => requireProjectKeys({ sonarqube: {}, sonarcloud: { projectKey: 'sc-key' } }),
    { instanceOf: ConfigurationError, message: /sonarqube.projectKey/ }
  );
});

test('requireProjectKeys throws when sonarcloud.projectKey missing', t => {
  t.throws(
    () => requireProjectKeys({ sonarqube: { projectKey: 'sq-key' }, sonarcloud: {} }),
    { instanceOf: ConfigurationError, message: /sonarcloud.projectKey/ }
  );
});

// validateConfig
test('validateConfig returns true for valid config', t => {
  const result = validateConfig({ ...validConfig });
  t.true(result);
});

test('validateConfig throws ValidationError for invalid config', t => {
  t.throws(
    () => validateConfig({}),
    { instanceOf: ValidationError }
  );
});

// loadMigrateConfig
test('loadMigrateConfig loads valid migrate config', async t => {
  const dir = getTmpDir();
  const path = await writeConfig(dir, 'migrate.json', validMigrateConfig);
  const config = await loadMigrateConfig(path);
  t.is(config.sonarqube.url, 'http://localhost:9000');
  t.is(config.sonarcloud.organizations.length, 1);
  t.is(config.sonarcloud.organizations[0].key, 'org1');
  t.is(config.sonarcloud.organizations[0].url, 'https://sonarcloud.io'); // default
  t.truthy(config.transfer);
  t.truthy(config.migrate);
  t.is(config.migrate.outputDir, './migration-output');
  await rm(dir, { recursive: true });
});

test('loadMigrateConfig throws for missing file', async t => {
  await t.throwsAsync(
    () => loadMigrateConfig('/nonexistent/migrate.json'),
    { instanceOf: ConfigurationError }
  );
});

test('loadMigrateConfig throws for invalid JSON', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'bad.json');
  await writeFile(path, '{bad json', 'utf-8');
  await t.throwsAsync(
    () => loadMigrateConfig(path),
    { instanceOf: ConfigurationError, message: /Invalid JSON/ }
  );
  await rm(dir, { recursive: true });
});

test('loadMigrateConfig throws ValidationError for invalid schema', async t => {
  const dir = getTmpDir();
  const path = await writeConfig(dir, 'migrate.json', { sonarqube: {} });
  await t.throwsAsync(
    () => loadMigrateConfig(path),
    { instanceOf: ValidationError }
  );
  await rm(dir, { recursive: true });
});

test.serial('loadMigrateConfig applies env overrides', async t => {
  const dir = getTmpDir();
  const path = await writeConfig(dir, 'migrate.json', validMigrateConfig);

  const origSqToken = process.env.SONARQUBE_TOKEN;
  const origSqUrl = process.env.SONARQUBE_URL;

  process.env.SONARQUBE_TOKEN = 'env_mig_token';
  process.env.SONARQUBE_URL = 'http://env-mig:9000';

  try {
    const config = await loadMigrateConfig(path);
    t.is(config.sonarqube.token, 'env_mig_token');
    t.is(config.sonarqube.url, 'http://env-mig:9000');
  } finally {
    if (origSqToken === undefined) delete process.env.SONARQUBE_TOKEN;
    else process.env.SONARQUBE_TOKEN = origSqToken;
    if (origSqUrl === undefined) delete process.env.SONARQUBE_URL;
    else process.env.SONARQUBE_URL = origSqUrl;
  }
  await rm(dir, { recursive: true });
});

test('loadMigrateConfig applies defaults for transfer and migrate', async t => {
  const dir = getTmpDir();
  const minCfg = {
    sonarqube: { url: 'http://localhost:9000', token: 'sqp_test' },
    sonarcloud: { organizations: [{ key: 'org1', token: 'tok1' }] }
  };
  const path = await writeConfig(dir, 'migrate.json', minCfg);
  const config = await loadMigrateConfig(path);
  t.truthy(config.transfer);
  t.is(config.transfer.mode, 'full');
  t.is(config.transfer.batchSize, 100);
  t.truthy(config.migrate);
  t.is(config.migrate.outputDir, './migration-output');
  await rm(dir, { recursive: true });
});

// --- Tests for uncovered error fallback paths ---

test.serial('loadConfig throws ConfigurationError for unexpected errors (null config body)', async t => {
  // JSON.parse('null') succeeds but returns null. With SONARQUBE_TOKEN set,
  // applyEnvironmentOverrides tries null.sonarqube.token which throws TypeError.
  // TypeError is not ValidationError/SyntaxError/ENOENT, so the fallback path is hit.
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'config.json');
  const { writeFile: wf } = await import('node:fs/promises');
  await wf(path, 'null', 'utf-8');

  const origToken = process.env.SONARQUBE_TOKEN;
  process.env.SONARQUBE_TOKEN = 'trigger-env-override';
  try {
    await t.throwsAsync(
      () => loadConfig(path),
      { instanceOf: ConfigurationError, message: /Failed to load configuration/ }
    );
  } finally {
    if (origToken === undefined) delete process.env.SONARQUBE_TOKEN;
    else process.env.SONARQUBE_TOKEN = origToken;
  }
  await rm(dir, { recursive: true });
});

test.serial('loadMigrateConfig throws ConfigurationError for unexpected errors (null config body)', async t => {
  // Same approach — null is valid JSON but with SONARQUBE_TOKEN set,
  // applyMigrateEnvOverrides tries null.sonarqube.token which throws TypeError.
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'migrate.json');
  const { writeFile: wf } = await import('node:fs/promises');
  await wf(path, 'null', 'utf-8');

  const origToken = process.env.SONARQUBE_TOKEN;
  process.env.SONARQUBE_TOKEN = 'trigger-env-override';
  try {
    await t.throwsAsync(
      () => loadMigrateConfig(path),
      { instanceOf: ConfigurationError, message: /Failed to load configuration/ }
    );
  } finally {
    if (origToken === undefined) delete process.env.SONARQUBE_TOKEN;
    else process.env.SONARQUBE_TOKEN = origToken;
  }
  await rm(dir, { recursive: true });
});

test('loadMigrateConfig applies default url for orgs without explicit url', async t => {
  // Exercises AJV useDefaults: default url from schema-migrate.js org items
  const dir = getTmpDir();
  const cfg = {
    sonarqube: { url: 'http://localhost:9000', token: 'sqp_test' },
    sonarcloud: {
      organizations: [
        { key: 'org-no-url', token: 'tok1' },
        { key: 'org-with-url', token: 'tok2', url: 'https://custom.sonarcloud.io' }
      ]
    }
  };
  const path = await writeConfig(dir, 'migrate.json', cfg);
  const config = await loadMigrateConfig(path);
  t.is(config.sonarcloud.organizations[0].url, 'https://sonarcloud.io');
  t.is(config.sonarcloud.organizations[1].url, 'https://custom.sonarcloud.io');
  await rm(dir, { recursive: true });
});

// Line 25: false branch of `if (!config.sonarcloud.url)` — when url is already in config JSON
test('loadConfig does not overwrite existing sonarcloud.url', async t => {
  const dir = getTmpDir();
  const cfg = {
    ...validConfig,
    sonarcloud: { ...validConfig.sonarcloud, url: 'https://custom-sonarcloud.example.com' }
  };
  const path = await writeConfig(dir, 'config.json', cfg);
  const config = await loadConfig(path);
  t.is(config.sonarcloud.url, 'https://custom-sonarcloud.example.com');
  await rm(dir, { recursive: true });
});

test('loadMigrateConfig applies default url to all orgs missing url', async t => {
  // Covers the AJV useDefaults default url from schema-migrate.js
  // when every org in the list lacks a url property
  const dir = getTmpDir();
  const cfg = {
    sonarqube: { url: 'http://localhost:9000', token: 'sqp_test' },
    sonarcloud: {
      organizations: [
        { key: 'org-alpha', token: 'tok-a' },
        { key: 'org-beta', token: 'tok-b' },
        { key: 'org-gamma', token: 'tok-c' }
      ]
    }
  };
  const path = await writeConfig(dir, 'migrate.json', cfg);
  const config = await loadMigrateConfig(path);
  for (const org of config.sonarcloud.organizations) {
    t.is(org.url, 'https://sonarcloud.io', `org ${org.key} should get default url`);
  }
  await rm(dir, { recursive: true });
});
