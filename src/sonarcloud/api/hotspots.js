import logger from '../../utils/logger.js';

export async function changeHotspotStatus(client, hotspot, status, resolution = null) {
  logger.debug(`Changing hotspot ${hotspot} status to ${status}`);

  const params = { hotspot, status };
  if (resolution) {
    params.resolution = resolution;
  }

  await client.post('/api/hotspots/change_status', null, { params });
}

export async function searchHotspots(client, projectKey, filters = {}) {
  logger.debug(`Searching hotspots in project: ${projectKey}`);

  let allResults = [];
  let page = 1;
  const pageSize = 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/hotspots/search', {
      params: {
        projectKey,
        ps: pageSize,
        p: page,
        ...filters
      }
    });

    const hotspots = response.data.hotspots || [];
    allResults = allResults.concat(hotspots);

    const total = response.data.paging?.total || 0;
    if (page * pageSize >= total || hotspots.length < pageSize) break;
    page++;
  }

  return allResults;
}

export async function addHotspotComment(client, hotspot, text) {
  logger.debug(`Adding comment to hotspot ${hotspot}`);

  await client.post('/api/hotspots/add_comment', null, {
    params: { hotspot, text }
  });
}
