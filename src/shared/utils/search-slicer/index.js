// -------- Dependencies --------

import logger from '../logger.js';
import { sliceByCreationDate } from './helpers/slice-by-creation-date.js';

// -------- Constants --------

import { API_RESULT_LIMIT } from './helpers/constants.js';

// -------- HTTP Paginators Factory --------

/**
 * Create the probeTotal / getPaginated function pair for a given HTTP client.
 * Centralises the pagination logic so each pipeline's search-issues.js
 * does not need to duplicate it.
 */
export function createHttpPaginators(client) {
  const probeTotalFn = async (endpoint, params) => {
    const response = await client.get(endpoint, { params: { ...params, ps: 1, p: 1 } });
    return response.data.paging?.total ?? 0;
  };

  const getPaginatedFn = async (endpoint, params, dataKey) => {
    let allResults = [];
    let page = 1;
    const pageSize = 500;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await client.get(endpoint, { params: { ...params, ps: pageSize, p: page } });
      const items = response.data[dataKey] || [];
      allResults = allResults.concat(items);
      const total = response.data.paging?.total || 0;
      if (page * pageSize >= total || items.length < pageSize) break;
      page++;
    }
    return allResults;
  };

  return { probeTotalFn, getPaginatedFn };
}

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
