import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Build extended query methods (new code periods, bindings, permissions, hotspots, rules).
 */
export function buildExtendedQueryMethods(client, organization, projectKey) {
  return {
    async getNewCodePeriods(pk) {
      let projectLevel = null;
      let branchOverrides = [];
      try { projectLevel = (await client.get('/api/new_code_periods/show', { params: { project: pk } })).data; }
      catch (e) { logger.debug(`No project-level new code period for ${pk}: ${e.message}`); }
      try { branchOverrides = (await client.get('/api/new_code_periods/list', { params: { project: pk } })).data.newCodePeriods || []; }
      catch (e) { logger.debug(`Failed to get branch-level new code periods for ${pk}: ${e.message}`); }
      return { projectLevel, branchOverrides };
    },
    async getProjectBinding(pk) {
      try { return (await client.get('/api/alm_settings/get_binding', { params: { project: pk } })).data; }
      catch (e) { logger.debug(`No binding found for project ${pk}: ${e.message}`); return null; }
    },
    async getGroups() { return this.getPaginated('/api/user_groups/search', { organization }, 'groups'); },
    async getGlobalPermissions() { return this.getPaginated('/api/permissions/groups', { organization, ps: 100 }, 'groups'); },
    async getProjectPermissions(pk) { return this.getPaginated('/api/permissions/groups', { projectKey: pk, organization, ps: 100 }, 'groups'); },
    async getPermissionTemplates() { return (await client.get('/api/permissions/search_templates', { params: { organization } })).data; },
    async getHotspotDetails(hk) { return (await client.get('/api/hotspots/show', { params: { hotspot: hk } })).data; },
    async getRuleRepositories() {
      try {
        const repos = ((await client.get('/api/rules/repositories')).data.repositories || []).map(r => r.key);
        logger.debug(`SonarCloud has ${repos.length} rule repositories`);
        return new Set(repos);
      } catch (e) {
        logger.warn(`Failed to fetch SonarCloud rule repositories: ${e.message}. External issue auto-detection will be skipped.`);
        return new Set();
      }
    },
  };
}
