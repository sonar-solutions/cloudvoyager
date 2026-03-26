// -------- Dependencies --------

import logger from '../../logger.js';
import { deduplicateResults } from './deduplicate-results.js';

// -------- Main Logic --------

/**
 * Fetches results for a single date window. If the window exceeds the
 * API result limit, it recursively splits into two smaller windows.
 *
 * @param {Function} probeTotalFn - Probes total count for a query
 * @param {Function} getPaginatedFn - Fetches paginated results
 * @param {string} endpoint - API endpoint
 * @param {object} params - Base query parameters
 * @param {string} dataKey - Response data key
 * @param {{ start: string, end: string }} window - Date window
 * @param {number} limit - API result limit
 * @returns {Promise<Array>} Results for this window
 */
export async function fetchWindow(
  probeTotalFn, getPaginatedFn, endpoint,
  params, dataKey, window, limit
) {
  const windowParams = {
    ...params,
    createdAfter: window.start,
    createdBefore: window.end
  };

  const total = await probeTotalFn(endpoint, windowParams, dataKey);
  logger.debug(
    `Window ${window.start} to ${window.end}: ${total} results`
  );

  if (total < limit) {
    return await getPaginatedFn(endpoint, windowParams, dataKey);
  }

  // Recursively split this window in half
  logger.warn(
    `Window still has ${total} results — splitting in half`
  );

  const midpoint = splitMidpoint(window.start, window.end);
  const leftWindow = { start: window.start, end: midpoint };
  const rightWindow = { start: midpoint, end: window.end };

  const leftResults = await fetchWindow(
    probeTotalFn, getPaginatedFn, endpoint,
    params, dataKey, leftWindow, limit
  );
  const rightResults = await fetchWindow(
    probeTotalFn, getPaginatedFn, endpoint,
    params, dataKey, rightWindow, limit
  );

  return deduplicateResults([...leftResults, ...rightResults]);
}

// -------- Helper --------

/** Returns the ISO midpoint between two date strings. */
function splitMidpoint(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return new Date(start + Math.floor((end - start) / 2)).toISOString();
}
