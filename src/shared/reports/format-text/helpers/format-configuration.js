// -------- Format Configuration --------

export function formatConfiguration(lines, results, subsep) {
  const cfg = results.configuration;
  if (!cfg) return;
  lines.push('CONFIGURATION', subsep);
  lines.push(`  Transfer Mode:       ${cfg.transferMode}`);
  lines.push(`  Batch Size:          ${cfg.batchSize}`);
  lines.push(`  Auto-Tune:           ${cfg.autoTune ? 'enabled' : 'disabled'}`);
  lines.push(`  Max Concurrency:     ${cfg.performance.maxConcurrency}`);
  lines.push(`  Source Extraction:   ${cfg.performance.sourceExtraction.concurrency} concurrent`);
  lines.push(`  Hotspot Extraction:  ${cfg.performance.hotspotExtraction.concurrency} concurrent`);
  lines.push(`  Issue Sync:          ${cfg.performance.issueSync.concurrency} concurrent`);
  lines.push(`  Hotspot Sync:        ${cfg.performance.hotspotSync.concurrency} concurrent`);
  lines.push(`  Project Migration:   ${cfg.performance.projectMigration.concurrency} concurrent`);
  if (cfg.rateLimit) {
    lines.push(`  Rate Limit Retries:  ${cfg.rateLimit.maxRetries}`);
    lines.push(`  Rate Limit Delay:    ${cfg.rateLimit.baseDelay}ms`);
    lines.push(`  Min Request Interval: ${cfg.rateLimit.minRequestInterval}ms`);
  }
  lines.push('');
}
