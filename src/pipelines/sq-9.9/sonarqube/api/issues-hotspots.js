import logger from '../../../../shared/utils/logger.js';
import { fetchWithSlicing } from '../../../../shared/utils/search-slicer/index.js';

// SonarQube 9.9 only supports the classic issue lifecycle statuses.
// FALSE_POSITIVE, ACCEPTED, FIXED are NOT valid in 9.9 (causes 400 error).
// CLOSED is excluded — resolved issues should not be recreated on the destination.
// RESOLVED is kept because it includes FALSE-POSITIVE and WONTFIX resolutions
// that should be migrated (downstream filter handles resolution=FIXED).
const ALL_STATUSES = 'OPEN,CONFIRMED,REOPENED,RESOLVED';

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
