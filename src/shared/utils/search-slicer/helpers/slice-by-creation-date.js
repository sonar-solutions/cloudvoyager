// -------- Dependencies --------

import logger from '../../logger.js';
import { findDateRange } from './find-date-range.js';
import { fetchWindow } from './fetch-window.js';
import { deduplicateResults } from './deduplicate-results.js';

// -------- Constants --------

const API_RESULT_LIMIT = 10000;
const INITIAL_WINDOW_COUNT = 12;

// -------- Main Logic --------

/**
 * Splits a query into date windows and fetches all results across them.
 * Recursively subdivides any window that still exceeds the 10K limit.
 */
export async function sliceByCreationDate(
  probeTotalFn, getPaginatedFn, endpoint, params, dataKey
) {
  const { oldest, newest } = await findDateRange(
    probeTotalFn, getPaginatedFn, endpoint, params, dataKey
  );

  if (!oldest || !newest) return [];

  const windows = buildWindows(oldest, newest, INITIAL_WINDOW_COUNT);
  logger.info(`Slicing into ${windows.length} date windows`);

  const allResults = [];

  for (const window of windows) {
    const results = await fetchWindow(
      probeTotalFn, getPaginatedFn, endpoint,
      params, dataKey, window, API_RESULT_LIMIT
    );
    allResults.push(...results);
  }

  return deduplicateResults(allResults);
}

// -------- Helper --------

/** Builds evenly-spaced date windows between two timestamps. */
function buildWindows(startDate, endDate, count) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const step = Math.ceil((end - start) / count);
  const windows = [];

  for (let i = 0; i < count; i++) {
    const windowStart = new Date(start + step * i).toISOString();
    const windowEnd = new Date(
      Math.min(start + step * (i + 1), end)
    ).toISOString();
    windows.push({ start: windowStart, end: windowEnd });
  }

  return windows;
}
