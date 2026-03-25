// -------- Log Auto-Tune Details --------
import logger from '../../logger.js';
import { getAutoTuneDefaults } from './get-auto-tune-defaults.js';

export function logAutoTuneDetails(perfConfig, cpuCount, totalMemMB, memInfo) {
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

  const pairs = [
    ['maxConcurrency', 'maxConcurrency'], ['maxMemoryMB', 'maxMemoryMB'],
    ['sourceExtraction.concurrency', 'sourceExtraction'], ['hotspotExtraction.concurrency', 'hotspotExtraction'],
    ['issueSync.concurrency', 'issueSync'], ['hotspotSync.concurrency', 'hotspotSync'],
    ['projectMigration.concurrency', 'projectMigration']
  ];
  const overrides = [];
  for (const [label, key] of pairs) {
    const cur = label.includes('.') ? perfConfig[key].concurrency : perfConfig[key];
    const def = label.includes('.') ? defaults[key].concurrency : defaults[key];
    if (cur !== def) overrides.push(`${label}: ${def} -> ${cur}`);
  }
  if (overrides.length > 0) {
    logger.debug('User overrides applied on top of auto-tune:');
    for (const o of overrides) logger.debug(`  ${o}`);
  } else {
    logger.debug('No user overrides — all values are auto-tuned defaults');
  }
}
