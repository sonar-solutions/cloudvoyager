import logger from './logger.js';

/**
 * Handle the case where no enterprise key is configured.
 * Logs a warning (if portfolios exist) or info, and records skipped count.
 *
 * @param {Array} portfolios - Portfolios extracted from the source SonarQube.
 * @param {object} results   - Mutable migration results object.
 * @returns {boolean} true if the enterprise key is missing (caller should return early).
 */
export function handleMissingEnterpriseKey(portfolios, results) {
  if (portfolios.length > 0) {
    results.portfoliosSkipped = (results.portfoliosSkipped || 0) + portfolios.length;
    logger.warn(`No enterprise key configured — skipping ${portfolios.length} portfolio(s)`);
  } else {
    logger.info('No enterprise key configured — skipping portfolio migration');
  }
}
