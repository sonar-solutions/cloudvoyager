// -------- Build Configuration --------

export function buildConfiguration(results) {
  const cfg = results.configuration;
  if (!cfg) return [];
  const body = [
    [{ text: 'Setting', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
    ['Transfer Mode', cfg.transferMode],
    ['Batch Size', String(cfg.batchSize)],
    ['Auto-Tune', cfg.autoTune ? 'Enabled' : 'Disabled'],
    ['Max Concurrency', String(cfg.performance.maxConcurrency)],
    ['Source Extraction', `${cfg.performance.sourceExtraction.concurrency} concurrent`],
    ['Hotspot Extraction', `${cfg.performance.hotspotExtraction.concurrency} concurrent`],
    ['Issue Sync', `${cfg.performance.issueSync.concurrency} concurrent`],
    ['Hotspot Sync', `${cfg.performance.hotspotSync.concurrency} concurrent`],
    ['Project Migration', `${cfg.performance.projectMigration.concurrency} concurrent`],
  ];
  if (cfg.rateLimit) {
    body.push(['Rate Limit Retries', String(cfg.rateLimit.maxRetries)]);
    body.push(['Rate Limit Base Delay', `${cfg.rateLimit.baseDelay}ms`]);
    body.push(['Min Request Interval', `${cfg.rateLimit.minRequestInterval}ms`]);
  }
  return [
    { text: 'Configuration', style: 'heading' },
    { table: { headerRows: 1, widths: [180, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
