import logger from '../../../../../shared/utils/logger.js';

// -------- Run Organization Step --------

export async function runOrgStep(orgResult, stepName, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    orgResult.steps.push({ step: stepName, status: 'success', durationMs: Date.now() - start, ...(detail && { detail }) });
  } catch (error) {
    orgResult.steps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    logger.error(`Failed to ${stepName.toLowerCase()}: ${error.message}`);
  }
}
