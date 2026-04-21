// -------- Dependencies --------

import logger from '../../logger.js';
import { fetchWindow } from './fetch-window.js';
import { deduplicateResults } from './deduplicate-results.js';
import { buildDateWindows } from './build-date-windows.js';

// -------- Constants --------

import { API_RESULT_LIMIT } from './constants.js';

const INITIAL_WINDOW_COUNT = 12;
// SonarQube was open-sourced in 2007; no issues can predate this epoch.
// Use +0000 format — SonarQube rejects ISO milliseconds (.000Z).
const SONARQUBE_EPOCH = '2006-01-01T00:00:00+0000';

// -------- Main Logic --------

/**
 * Splits a query into date windows spanning the full SonarQube era and
 * fetches all results. Uses a fixed epoch instead of probing the date range
 * — probing with getPaginatedFn(ps=1) would loop page-by-page and hit the
 * Elasticsearch 10K limit on large projects before finding the boundary.
 * Recursively subdivides any window that still exceeds the 10K limit.
 */
export async function sliceByCreationDate(
  probeTotalFn, getPaginatedFn, endpoint, params, dataKey
) {
  const now = new Date().toISOString();
  const windows = buildDateWindows(SONARQUBE_EPOCH, now, INITIAL_WINDOW_COUNT);
  logger.info(`Slicing into ${windows.length} windows (${SONARQUBE_EPOCH.slice(0, 10)} → ${now.slice(0, 10)})`);

  const allResults = [];

  for (let i = 0; i < windows.length; i++) {
    const results = await fetchWindow(
      probeTotalFn, getPaginatedFn, endpoint,
      params, dataKey, windows[i], API_RESULT_LIMIT
    );
    allResults.push(...results);
    logger.info(`Window ${i + 1}/${windows.length}: fetched ${results.length} (total so far: ${allResults.length})`);
  }

  return deduplicateResults(allResults);
}
