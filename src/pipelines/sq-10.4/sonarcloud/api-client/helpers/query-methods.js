import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Build read-only query methods (used by verification and sync).
 */
export function buildQueryMethods(client, organization, projectKey) {
  return {
    async getPaginated(endpoint, params = {}, dataKey = 'components') {
      let allResults = [];
      let page = 1;
      const pageSize = params.ps || 500;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const response = await client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
        const results = response.data[dataKey] || [];
        allResults = allResults.concat(results);
        const total = response.data.paging?.total || response.data.total || 0;
        if (page * pageSize >= total || results.length < pageSize) break;
        page++;
      }
      return allResults;
    },
    async listProjects() { return this.getPaginated('/api/projects/search', { organization }, 'components'); },
    async getProjectBranches(pk) { return (await client.get('/api/project_branches/list', { params: { project: pk } })).data.branches || []; },
    async listQualityGates() { return (await client.get('/api/qualitygates/list', { params: { organization } })).data; },
    async getQualityGateDetails(id) { return (await client.get('/api/qualitygates/show', { params: { id, organization } })).data; },
    async getQualityGateForProject(pk) {
      try { return (await client.get('/api/qualitygates/get_by_project', { params: { project: pk, organization } })).data.qualityGate || null; }
      catch (e) { logger.debug(`Failed to get quality gate for project ${pk}: ${e.message}`); return null; }
    },
    async getProjectMeasures(pk, metricKeys) { return (await client.get('/api/measures/component', { params: { component: pk, metricKeys: metricKeys.join(',') } })).data.component || {}; },
    async getProjectSettings(pk) { return (await client.get('/api/settings/values', { params: { component: pk } })).data.settings || []; },
    async getProjectLinks(pk) { return (await client.get('/api/project_links/search', { params: { projectKey: pk } })).data.links || []; },
    async getProjectTagsForProject(pk) {
      try { return (await client.get('/api/project_tags/search', { params: { project: pk, ps: 100 } })).data.tags || []; }
      catch (e) { logger.debug(`Failed to get project tags for ${pk}: ${e.message}`); return []; }
    },
  };
}
