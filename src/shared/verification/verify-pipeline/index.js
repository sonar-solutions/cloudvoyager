// -------- Verification Pipeline --------

import { mkdir } from 'node:fs/promises';
import { resolvePerformanceConfig, collectEnvironmentInfo } from '../../utils/concurrency.js';
import logger from '../../utils/logger.js';
import { writeVerificationReports, logVerificationSummary } from '../reports/index.js';
import { createEmptyResults } from './helpers/create-empty-results.js';
import { computeSummary } from './helpers/compute-summary.js';
import { runPipelineSteps } from './helpers/run-pipeline-steps.js';

/**
 * Run the full verification pipeline.
 */
export async function verifyAll(options) {
  const {
    sonarqubeConfig, sonarcloudOrgs, rateLimitConfig,
    performanceConfig: rawPerfConfig = {}, outputDir = './verification-output', onlyComponents = null,
  } = options;

  const perfConfig = resolvePerformanceConfig(rawPerfConfig);
  const results = createEmptyResults();
  results.environment = collectEnvironmentInfo();
  results.startTime = new Date().toISOString();
  await mkdir(outputDir, { recursive: true });
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);

  try {
    await runPipelineSteps(results, sonarqubeConfig, sonarcloudOrgs, rateLimitConfig, perfConfig, shouldRun);
  } finally {
    results.endTime = new Date().toISOString();
    computeSummary(results);
    logVerificationSummary(results);
    try { await writeVerificationReports(results, outputDir); } catch (e) { logger.error(`Failed to write reports: ${e.message}`); }
  }

  return results;
}
