import test from 'ava';
import { configSchema, migrateConfigSchema } from '../../src/config/schema.js';

test('configSchema is a valid JSON schema object', t => {
  t.is(configSchema.type, 'object');
  t.deepEqual(configSchema.required, ['sonarqube', 'sonarcloud']);
  t.truthy(configSchema.properties.sonarqube);
  t.truthy(configSchema.properties.sonarcloud);
  t.truthy(configSchema.properties.transfer);
  t.truthy(configSchema.properties.transferAll);
  t.truthy(configSchema.properties.migrate);
  t.truthy(configSchema.properties.rateLimit);
  t.truthy(configSchema.properties.performance);
});

test('configSchema sonarqube requires url and token', t => {
  const sq = configSchema.properties.sonarqube;
  t.deepEqual(sq.required, ['url', 'token']);
  t.truthy(sq.properties.url);
  t.truthy(sq.properties.token);
  t.truthy(sq.properties.projectKey);
});

test('configSchema sonarcloud requires token and organization', t => {
  const sc = configSchema.properties.sonarcloud;
  t.deepEqual(sc.required, ['token', 'organization']);
  t.truthy(sc.properties.url);
  t.truthy(sc.properties.token);
  t.truthy(sc.properties.organization);
  t.truthy(sc.properties.projectKey);
});

test('configSchema transfer has mode, stateFile, batchSize', t => {
  const transfer = configSchema.properties.transfer;
  t.truthy(transfer.properties.mode);
  t.deepEqual(transfer.properties.mode.enum, ['full', 'incremental']);
  t.truthy(transfer.properties.stateFile);
  t.truthy(transfer.properties.batchSize);
});

test('configSchema performance has all concurrency settings', t => {
  const perf = configSchema.properties.performance;
  t.truthy(perf.properties.autoTune);
  t.truthy(perf.properties.maxConcurrency);
  t.truthy(perf.properties.maxMemoryMB);
  t.truthy(perf.properties.sourceExtraction);
  t.truthy(perf.properties.hotspotExtraction);
  t.truthy(perf.properties.issueSync);
  t.truthy(perf.properties.hotspotSync);
  t.truthy(perf.properties.projectMigration);
});

test('configSchema rateLimit has retry settings', t => {
  const rl = configSchema.properties.rateLimit;
  t.truthy(rl.properties.maxRetries);
  t.truthy(rl.properties.baseDelay);
  t.truthy(rl.properties.minRequestInterval);
});

test('migrateConfigSchema is a valid JSON schema object', t => {
  t.is(migrateConfigSchema.type, 'object');
  t.deepEqual(migrateConfigSchema.required, ['sonarqube', 'sonarcloud']);
});

test('migrateConfigSchema sonarcloud uses organizations array', t => {
  const sc = migrateConfigSchema.properties.sonarcloud;
  t.deepEqual(sc.required, ['organizations']);
  t.truthy(sc.properties.organizations);
  t.is(sc.properties.organizations.type, 'array');
  t.is(sc.properties.organizations.minItems, 1);
});

test('migrateConfigSchema organization items require key and token', t => {
  const item = migrateConfigSchema.properties.sonarcloud.properties.organizations.items;
  t.deepEqual(item.required, ['key', 'token']);
  t.truthy(item.properties.key);
  t.truthy(item.properties.token);
  t.truthy(item.properties.url);
});

test('migrateConfigSchema has transfer, migrate, rateLimit, performance', t => {
  t.truthy(migrateConfigSchema.properties.transfer);
  t.truthy(migrateConfigSchema.properties.migrate);
  t.truthy(migrateConfigSchema.properties.rateLimit);
  t.truthy(migrateConfigSchema.properties.performance);
});
