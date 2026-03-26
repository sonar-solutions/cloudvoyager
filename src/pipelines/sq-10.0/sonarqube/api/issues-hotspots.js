import logger from '../../../../shared/utils/logger.js';
import { fetchWithSlicing } from '../../../../shared/utils/search-slicer/index.js';

// All issue statuses — pre-10.4 lifecycle + 10.4+ lifecycle.
// The SonarQube API ignores unknown values, so including both sets is safe.
const ALL_STATUSES = 'OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED,FALSE_POSITIVE,ACCEPTED,FIXED';

export async function getIssues(probeTotal, getPaginated, projectKey, filters = {}) {
  logger.info(`Fetching issues for project: ${projectKey}`);
  const params = { componentKeys: projectKey, statuses: ALL_STATUSES, ...filters };
  return await fetchWithSlicing(probeTotal, getPaginated, '/api/issues/search', params, 'issues');
}

export async function getIssuesWithComments(probeTotal, getPaginated, projectKey, filters = {}) {
  logger.info(`Fetching issues with comments for project: ${projectKey}`);
  const params = { componentKeys: projectKey, additionalFields: 'comments', statuses: ALL_STATUSES, ...filters };
  return await fetchWithSlicing(probeTotal, getPaginated, '/api/issues/search', params, 'issues');
}

export async function getIssueChangelog(client, issueKey) {
  logger.debug(`Fetching changelog for issue: ${issueKey}`);
  const response = await client.get('/api/issues/changelog', { params: { issue: issueKey } });
  return response.data.changelog || [];
}

export async function getHotspots(probeTotal, getPaginated, projectKey, filters = {}) {
  logger.info(`Fetching hotspots for project: ${projectKey}`);
  const params = { projectKey, ...filters };
  return await fetchWithSlicing(probeTotal, getPaginated, '/api/hotspots/search', params, 'hotspots');
}

export async function getHotspotDetails(client, hotspotKey) {
  logger.debug(`Fetching hotspot details: ${hotspotKey}`);
  const response = await client.get('/api/hotspots/show', { params: { hotspot: hotspotKey } });
  return response.data;
}
