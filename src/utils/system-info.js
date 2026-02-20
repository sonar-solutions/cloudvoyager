import { availableParallelism as _availableParallelism, cpus, totalmem } from 'node:os';

const availableParallelism = typeof _availableParallelism === 'function'
  ? _availableParallelism
  : () => cpus().length;
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import v8 from 'node:v8';
import logger from './logger.js';

function getAutoTuneDefaults() {
  const cpuCount = availableParallelism();
  const totalMemMB = Math.round(totalmem() / 1024 / 1024);
  const safeMemoryMB = Math.min(Math.round(totalMemMB * 0.75), 16384);
  return {
    maxConcurrency: cpuCount,
    maxMemoryMB: safeMemoryMB,
    sourceExtraction: { concurrency: cpuCount * 2 },
    hotspotExtraction: { concurrency: cpuCount * 2 },
    issueSync: { concurrency: cpuCount },
    hotspotSync: { concurrency: Math.min(Math.max(Math.floor(cpuCount / 2), 3), 5) },
    projectMigration: { concurrency: Math.max(1, Math.floor(cpuCount / 3)) }
  };
}

export function resolvePerformanceConfig(perfConfig = {}) {
  const cpuCount = availableParallelism();
  const defaults = perfConfig.autoTune ? getAutoTuneDefaults() : {
    maxConcurrency: Math.min(cpuCount, 8),
    maxMemoryMB: 0,
    sourceExtraction: { concurrency: 10 },
    hotspotExtraction: { concurrency: 10 },
    issueSync: { concurrency: 5 },
    hotspotSync: { concurrency: 3 },
    projectMigration: { concurrency: 1 }
  };
  return {
    autoTune: perfConfig.autoTune || false,
    maxConcurrency: perfConfig.maxConcurrency || defaults.maxConcurrency,
    maxMemoryMB: perfConfig.maxMemoryMB || defaults.maxMemoryMB,
    sourceExtraction: { concurrency: perfConfig.sourceExtraction?.concurrency || defaults.sourceExtraction.concurrency },
    hotspotExtraction: { concurrency: perfConfig.hotspotExtraction?.concurrency || defaults.hotspotExtraction.concurrency },
    issueSync: { concurrency: perfConfig.issueSync?.concurrency || defaults.issueSync.concurrency },
    hotspotSync: { concurrency: perfConfig.hotspotSync?.concurrency || defaults.hotspotSync.concurrency },
    projectMigration: { concurrency: perfConfig.projectMigration?.concurrency || defaults.projectMigration.concurrency }
  };
}

export function ensureHeapSize(maxMemoryMB) {
  if (!maxMemoryMB || maxMemoryMB <= 0) return;
  if (process.env.CLOUDVOYAGER_RESPAWNED) return;
  // Bun uses JavaScriptCore, not V8 — --max-old-space-size is meaningless.
  // Skip heap resize entirely for Bun-compiled binaries.
  const isBunCompiled = process.argv.length >= 2 && process.argv[1].includes('$bunfs');
  if (isBunCompiled) return;
  const currentLimit = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
  if (currentLimit >= maxMemoryMB) return;
  const existingNodeOptions = process.env.NODE_OPTIONS || '';
  const newNodeOptions = `${existingNodeOptions} --max-old-space-size=${maxMemoryMB}`.trim();
  logger.info(`Restarting with ${maxMemoryMB}MB heap (current: ${currentLimit}MB)...`);
  // In a Node.js SEA binary, argv[1] duplicates argv[0] (the binary path).
  // Strip it so Commander doesn't receive the binary path as a command argument.
  const isSEA = process.argv.length >= 2 && resolve(process.argv[0]) === resolve(process.argv[1]);
  const respawnArgs = process.argv.slice(isSEA ? 2 : 1);
  const result = spawnSync(process.execPath, respawnArgs, {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: newNodeOptions, CLOUDVOYAGER_RESPAWNED: '1' }
  });
  process.exit(result.status ?? 1);
}

export function getMemoryInfo() {
  const heapStats = v8.getHeapStatistics();
  return {
    heapSizeLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
    usedHeapMB: Math.round(heapStats.used_heap_size / 1024 / 1024),
    totalHeapMB: Math.round(heapStats.total_heap_size / 1024 / 1024)
  };
}

export function logSystemInfo(perfConfig) {
  const cpuCount = availableParallelism();
  const totalMemMB = Math.round(totalmem() / 1024 / 1024);
  const memInfo = getMemoryInfo();
  logger.info(`System: ${cpuCount} CPU cores, ${totalMemMB}MB total RAM, ${memInfo.heapSizeLimitMB}MB heap limit`);
  const concurrencyInfo = [
    `sources=${perfConfig.sourceExtraction.concurrency}`,
    `hotspots=${perfConfig.hotspotExtraction.concurrency}`,
    `issueSync=${perfConfig.issueSync.concurrency}`,
    `hotspotSync=${perfConfig.hotspotSync.concurrency}`,
    `projects=${perfConfig.projectMigration.concurrency}`
  ].join(', ');
  const tuneLabel = perfConfig.autoTune ? 'Performance (auto-tuned)' : 'Performance';
  logger.info(`${tuneLabel}: concurrency=[${concurrencyInfo}]`);

  if (perfConfig.autoTune) {
    const defaults = getAutoTuneDefaults();
    logger.debug('Auto-tune detected hardware:');
    logger.debug(`  CPU cores: ${cpuCount}`);
    logger.debug(`  Total RAM: ${totalMemMB}MB`);
    logger.debug(`  Safe memory (75% of RAM, max 16GB): ${defaults.maxMemoryMB}MB`);
    logger.debug(`  Current heap limit: ${memInfo.heapSizeLimitMB}MB`);
    logger.debug('Auto-tune calculated settings:');
    logger.debug(`  maxConcurrency: ${defaults.maxConcurrency} (= CPU cores)`);
    logger.debug(`  maxMemoryMB: ${defaults.maxMemoryMB}`);
    logger.debug(`  sourceExtraction.concurrency: ${defaults.sourceExtraction.concurrency} (= CPU cores x2)`);
    logger.debug(`  hotspotExtraction.concurrency: ${defaults.hotspotExtraction.concurrency} (= CPU cores x2)`);
    logger.debug(`  issueSync.concurrency: ${defaults.issueSync.concurrency} (= CPU cores)`);
    logger.debug(`  hotspotSync.concurrency: ${defaults.hotspotSync.concurrency} (= min(max(CPU/2, 3), 5))`);
    logger.debug(`  projectMigration.concurrency: ${defaults.projectMigration.concurrency} (= max(1, CPU/3))`);

    const overrides = [];
    if (perfConfig.maxConcurrency !== defaults.maxConcurrency) overrides.push(`maxConcurrency: ${defaults.maxConcurrency} -> ${perfConfig.maxConcurrency}`);
    if (perfConfig.maxMemoryMB !== defaults.maxMemoryMB) overrides.push(`maxMemoryMB: ${defaults.maxMemoryMB} -> ${perfConfig.maxMemoryMB}`);
    if (perfConfig.sourceExtraction.concurrency !== defaults.sourceExtraction.concurrency) overrides.push(`sourceExtraction.concurrency: ${defaults.sourceExtraction.concurrency} -> ${perfConfig.sourceExtraction.concurrency}`);
    if (perfConfig.hotspotExtraction.concurrency !== defaults.hotspotExtraction.concurrency) overrides.push(`hotspotExtraction.concurrency: ${defaults.hotspotExtraction.concurrency} -> ${perfConfig.hotspotExtraction.concurrency}`);
    if (perfConfig.issueSync.concurrency !== defaults.issueSync.concurrency) overrides.push(`issueSync.concurrency: ${defaults.issueSync.concurrency} -> ${perfConfig.issueSync.concurrency}`);
    if (perfConfig.hotspotSync.concurrency !== defaults.hotspotSync.concurrency) overrides.push(`hotspotSync.concurrency: ${defaults.hotspotSync.concurrency} -> ${perfConfig.hotspotSync.concurrency}`);
    if (perfConfig.projectMigration.concurrency !== defaults.projectMigration.concurrency) overrides.push(`projectMigration.concurrency: ${defaults.projectMigration.concurrency} -> ${perfConfig.projectMigration.concurrency}`);

    if (overrides.length > 0) {
      logger.debug('User overrides applied on top of auto-tune:');
      for (const o of overrides) logger.debug(`  ${o}`);
    } else {
      logger.debug('No user overrides — all values are auto-tuned defaults');
    }
  }
}
