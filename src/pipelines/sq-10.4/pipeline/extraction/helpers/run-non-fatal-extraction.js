import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Run an extraction step, logging and recording result. Does not throw on failure.
export async function runNonFatalExtraction(results, stepName, fn, detailFn) {
  try {
    logger.info(`Extracting ${stepName}...`);
    const data = await fn();
    const detail = detailFn ? detailFn(data) : undefined;
    results.serverSteps.push({ step: `Extract ${stepName}`, status: 'success', ...(detail && { detail }) });
    return data;
  } catch (error) {
    results.serverSteps.push({ step: `Extract ${stepName}`, status: 'failed', error: error.message });
    logger.error(`Failed to extract ${stepName}: ${error.message}`);
    return undefined;
  }
}
