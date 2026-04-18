import logger from '../logger.js';

/**
 * Retry fetching SC items with exponential backoff when the initial search
 * returns 0 results but there are SQ items that need syncing.
 * This handles the race condition where SC has not yet finished indexing
 * the analysis on a first migration (Issue #91).
 */
export async function waitForScIndexing(fetchFn, sqCount, options = {}) {
  const { label = 'items', projectKey = '?', maxRetries = 10, initialDelayMs = 10000, maxDelayMs = 60000 } = options;
  if (sqCount === 0) return [];

  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      logger.warn(`[${projectKey}] SC ${label} not yet indexed (attempt ${attempt}/${maxRetries}), retrying in ${(delay / 1000).toFixed(0)}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelayMs);
    }
    let items;
    try {
      items = await fetchFn();
    } catch (err) {
      logger.warn(`[${projectKey}] SC ${label} fetch error on attempt ${attempt}/${maxRetries}: ${err.message}`);
      items = [];
    }
    if (items.length > 0) {
      if (attempt > 1) logger.info(`[${projectKey}] SC ${label} now available after ${attempt} attempts`);
      return items;
    }
  }
  logger.warn(`[${projectKey}] SC ${label} still empty after ${maxRetries} retries; proceeding with 0 matches`);
  return [];
}
