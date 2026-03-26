// -------- Probe Total Count --------

import logger from '../../../../../shared/utils/logger.js';

/**
 * Lightweight probe that fetches page 1 with ps=1 to extract total count
 * without fetching full data. Used by search-slicer to detect 10K+ results.
 */
export async function probeTotal(client, endpoint, params = {}, dataKey = 'components') {
  const response = await client.get(endpoint, { params: { ...params, ps: 1, p: 1 } });
  return response.data.paging?.total ?? response.data.total ?? 0;
}
