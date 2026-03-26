// -------- Dependencies --------

import logger from '../../logger.js';

// -------- Main Logic --------

/**
 * Finds the creation date range for a given search query by fetching
 * the oldest and newest items (sorted by CREATION_DATE).
 *
 * @returns {Promise<{ oldest: string, newest: string }>} ISO date strings
 */
export async function findDateRange(
  probeTotalFn, getPaginatedFn, endpoint, params, dataKey
) {
  logger.info('Probing date range for search slicing...');

  // Fetch oldest item
  const oldestParams = {
    ...params, s: 'CREATION_DATE', asc: 'true', ps: 1
  };
  const oldestResults = await getPaginatedFn(
    endpoint, oldestParams, dataKey
  );

  // Fetch newest item
  const newestParams = {
    ...params, s: 'CREATION_DATE', asc: 'false', ps: 1
  };
  const newestResults = await getPaginatedFn(
    endpoint, newestParams, dataKey
  );

  const oldest = oldestResults[0]?.creationDate || oldestResults[0]?.createdAt;
  const newest = newestResults[0]?.creationDate || newestResults[0]?.createdAt;

  logger.info(`Date range: ${oldest} to ${newest}`);

  return { oldest, newest };
}
