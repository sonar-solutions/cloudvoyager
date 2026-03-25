import logger from '../../../../../shared/utils/logger.js';

// -------- Run Non-Fatal Extraction --------

/** Run an extraction step that logs failures but does not throw. */
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
