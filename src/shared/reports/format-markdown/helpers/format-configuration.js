// -------- Format Configuration --------

export function formatConfiguration(results) {
  const cfg = results.configuration;
  if (!cfg) return null;
  const lines = [
    '## Configuration\n',
    '| Setting | Value |',
    '|---------|-------|',
    `| Transfer Mode | ${cfg.transferMode} |`,
    `| Batch Size | ${cfg.batchSize} |`,
    `| Auto-Tune | ${cfg.autoTune ? 'Enabled' : 'Disabled'} |`,
    `| Max Concurrency | ${cfg.performance.maxConcurrency} |`,
    `| Source Extraction | ${cfg.performance.sourceExtraction.concurrency} concurrent |`,
    `| Hotspot Extraction | ${cfg.performance.hotspotExtraction.concurrency} concurrent |`,
    `| Issue Sync | ${cfg.performance.issueSync.concurrency} concurrent |`,
    `| Hotspot Sync | ${cfg.performance.hotspotSync.concurrency} concurrent |`,
    `| Project Migration | ${cfg.performance.projectMigration.concurrency} concurrent |`,
  ];
  if (cfg.rateLimit) {
    lines.push(
      `| Rate Limit Retries | ${cfg.rateLimit.maxRetries} |`,
      `| Rate Limit Base Delay | ${cfg.rateLimit.baseDelay}ms |`,
      `| Min Request Interval | ${cfg.rateLimit.minRequestInterval}ms |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
