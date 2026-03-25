import logger from '../../../../../../shared/utils/logger.js';

// -------- Log Rule Diff Results --------

export function logDiffResults(language, missingRules, addedRules, totalRules) {
  if (missingRules.length > 0) {
    logger.warn(`  ${language}: ${missingRules.length} rules missing from SonarCloud: ${missingRules.map(r => r.key).join(', ')}`);
  }
  if (addedRules.length > 0) logger.info(`  ${language}: ${addedRules.length} rules added in SonarCloud`);
  if (missingRules.length === 0 && addedRules.length === 0) logger.info(`  ${language}: profiles match perfectly (${totalRules} rules)`);
}
