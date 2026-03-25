import { collectEnvironmentInfo } from '../../../../shared/utils/concurrency.js';
import { createEmptyResults } from '../../pipeline/results.js';

// -------- Build Initial Results Object with Configuration --------

export function buildResultsConfig(perfConfig, transferConfig, rateLimitConfig) {
  const results = createEmptyResults();
  results.environment = collectEnvironmentInfo();
  results.configuration = {
    transferMode: transferConfig.mode || 'full',
    batchSize: transferConfig.batchSize || 100,
    autoTune: perfConfig.autoTune || false,
    performance: {
      maxConcurrency: perfConfig.maxConcurrency,
      sourceExtraction: { concurrency: perfConfig.sourceExtraction.concurrency },
      hotspotExtraction: { concurrency: perfConfig.hotspotExtraction.concurrency },
      issueSync: { concurrency: perfConfig.issueSync.concurrency },
      hotspotSync: { concurrency: perfConfig.hotspotSync.concurrency },
      projectMigration: { concurrency: perfConfig.projectMigration.concurrency },
    },
    rateLimit: rateLimitConfig
      ? { maxRetries: rateLimitConfig.maxRetries ?? 3, baseDelay: rateLimitConfig.baseDelay ?? 1000, minRequestInterval: rateLimitConfig.minRequestInterval ?? 0 }
      : { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
  };
  return results;
}
