import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './get-paginated.js';
import * as iss from '../../api/issues.js';
import { FALLBACK_SONARCLOUD_REPOS } from '../../../../../shared/utils/fallback-repos/index.js';

// -------- Extended Query Methods (new code periods, bindings, permissions, etc.) --------

export async function getNewCodePeriods(ctx, pk) {
  let projectLevel = null;
  let branchOverrides = [];
  try { const r = await ctx.client.get('/api/new_code_periods/show', { params: { project: pk } }); projectLevel = r.data; } catch (e) { logger.debug(`No project-level new code period for ${pk}: ${e.message}`); }
  try { const r = await ctx.client.get('/api/new_code_periods/list', { params: { project: pk } }); branchOverrides = r.data.newCodePeriods || []; } catch (e) { logger.debug(`Failed to get branch-level new code periods for ${pk}: ${e.message}`); }
  return { projectLevel, branchOverrides };
}

export async function getProjectBinding(ctx, pk) {
  try { const r = await ctx.client.get('/api/alm_settings/get_binding', { params: { project: pk } }); return r.data; } catch (e) { logger.debug(`No binding found for project ${pk}: ${e.message}`); return null; }
}

export async function getGroups(ctx) { return getPaginated(ctx.client, '/api/user_groups/search', { organization: ctx.organization }, 'groups'); }
export async function getGlobalPermissions(ctx) { return getPaginated(ctx.client, '/api/permissions/groups', { organization: ctx.organization, ps: 100 }, 'groups'); }
export async function getProjectPermissions(ctx, pk) { return getPaginated(ctx.client, '/api/permissions/groups', { projectKey: pk, organization: ctx.organization, ps: 100 }, 'groups'); }
export async function getPermissionTemplates(ctx) { const r = await ctx.client.get('/api/permissions/search_templates', { params: { organization: ctx.organization } }); return r.data; }
export async function searchIssuesWithComments(ctx, pk, filters = {}) { return iss.searchIssues(ctx.client, ctx.organization, pk, { additionalFields: 'comments', ...filters }); }
export async function getHotspotDetails(ctx, hk) { const r = await ctx.client.get('/api/hotspots/show', { params: { hotspot: hk } }); return r.data; }

export async function getRuleRepositories(ctx) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await ctx.client.get('/api/rules/repositories');
      const repos = (r.data.repositories || []).map(x => x.key);
      logger.debug(`SonarCloud has ${repos.length} rule repositories`);
      return new Set(repos);
    } catch (e) {
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed to fetch rule repositories: ${e.message}`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  logger.warn('All retries exhausted — falling back to built-in rule repository list');
  return FALLBACK_SONARCLOUD_REPOS;
}
