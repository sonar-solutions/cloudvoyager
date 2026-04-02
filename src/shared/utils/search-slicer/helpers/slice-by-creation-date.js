// -------- Dependencies --------

import logger from '../../logger.js';
import { mapConcurrent } from '../../concurrency/helpers/map-concurrent.js';
import { fetchWindow } from './fetch-window.js';
import { deduplicateResults } from './deduplicate-results.js';
import { buildDateWindows } from './build-date-windows.js';

// -------- Constants --------

const API_RESULT_LIMIT = 10000;
const INITIAL_WINDOW_COUNT = 12;
const DEFAULT_CONCURRENCY = 6;
// SonarQube was open-sourced in 2007; no issues can predate this epoch.
// Use +0000 format — SonarQube rejects ISO milliseconds (.000Z).
const SONARQUBE_EPOCH = '2006-01-01T00:00:00+0000';

// -------- Main Logic --------

/**
 * Splits a query into date windows and fetches all results in parallel.
 * Uses mapConcurrent to run up to `concurrency` windows simultaneously.
 * Recursively subdivides any window that still exceeds the 10K limit.
 */
export async function sliceByCreationDate(
  probeTotalFn, getPaginatedFn, endpoint, params, dataKey,
  { concurrency = DEFAULT_CONCURRENCY } = {}
) {
  const now = new Date().toISOString();
  const windows = buildDateWindows(SONARQUBE_EPOCH, now, INITIAL_WINDOW_COUNT);
  logger.info(`Slicing into ${windows.length} windows (${SONARQUBE_EPOCH.slice(0, 10)} → ${now.slice(0, 10)})`);

  const windowResults = await mapConcurrent(windows, async (window, i) => {
    const results = await fetchWindow(
      probeTotalFn, getPaginatedFn, endpoint,
      params, dataKey, window, API_RESULT_LIMIT
    );
    logger.info(`Window ${i + 1}/${windows.length}: fetched ${results.length}`);
    return results;
  }, { concurrency });

  return deduplicateResults(windowResults.flat());
}
