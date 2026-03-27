// -------- Dependencies --------

import logger from '../../logger.js';
import { deduplicateResults } from './deduplicate-results.js';
import { splitMidpoint } from './split-midpoint.js';

// -------- Main Logic --------

/**
 * Fetches results for a single date window. If the window exceeds the
 * API result limit, it recursively splits into two smaller windows.
 * If the window cannot be split further (same-millisecond boundary),
 * fetches directly — unavoidable SonarQube API limitation.
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
  logger.info(`  Window ${window.start.slice(0, 10)} → ${window.end.slice(0, 10)}: ${total} results`);

  if (total < limit) return await getPaginatedFn(endpoint, windowParams, dataKey);

  const midpoint = splitMidpoint(window.start, window.end);

  // If midpoint equals either boundary the window is at minimum granularity —
  // splitting would loop forever, so fetch directly despite exceeding the limit.
  if (midpoint === window.start || midpoint === window.end) {
    logger.warn(`Window unsplittable — fetching ${total} results directly (same-ms boundary)`);
    return await getPaginatedFn(endpoint, windowParams, dataKey);
  }

  logger.warn(`Window has ${total} results — splitting at ${midpoint.slice(0, 10)}`);

  const leftResults = await fetchWindow(
    probeTotalFn, getPaginatedFn, endpoint,
    params, dataKey, { start: window.start, end: midpoint }, limit
  );
  const rightResults = await fetchWindow(
    probeTotalFn, getPaginatedFn, endpoint,
    params, dataKey, { start: midpoint, end: window.end }, limit
  );

  return deduplicateResults([...leftResults, ...rightResults]);
}
