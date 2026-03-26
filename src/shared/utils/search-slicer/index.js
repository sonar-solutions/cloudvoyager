// -------- Dependencies --------

import logger from '../logger.js';
import { sliceByCreationDate } from './helpers/slice-by-creation-date.js';

// -------- Constants --------

const API_RESULT_LIMIT = 10000;

// -------- Main Logic --------

/**
 * Fetches all results from a SonarQube search endpoint that may exceed
 * the 10K API limit. Probes the total count first, then uses date-window
 * slicing when results exceed the limit.
 *
 * @param {Function} probeTotalFn - Returns { total } for given endpoint/params
 * @param {Function} getPaginatedFn - Standard getPaginated(endpoint, params, dataKey)
 * @param {string} endpoint - API endpoint path
 * @param {object} params - Query parameters
 * @param {string} dataKey - Response data key (e.g. 'issues', 'hotspots')
 * @returns {Promise<Array>} All results, deduplicated
 */
export async function fetchWithSlicing(
  probeTotalFn, getPaginatedFn, endpoint, params, dataKey
) {
  const total = await probeTotalFn(endpoint, params, dataKey);

  if (total < API_RESULT_LIMIT) {
    return await getPaginatedFn(endpoint, params, dataKey);
  }

  logger.warn(
    `${endpoint} returned ${total} results (limit: ${API_RESULT_LIMIT}) — activating date-window slicing`
  );

  return await sliceByCreationDate(
    probeTotalFn, getPaginatedFn, endpoint, params, dataKey
  );
}
