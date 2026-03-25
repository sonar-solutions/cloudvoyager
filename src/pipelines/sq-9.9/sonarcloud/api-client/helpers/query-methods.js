import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './get-paginated.js';

// -------- Read-Only Query Methods (used by verification) --------

export async function listProjects(ctx) { return getPaginated(ctx.client, '/api/projects/search', { organization: ctx.organization }, 'components'); }
export async function getProjectBranches(ctx, pk) { const r = await ctx.client.get('/api/project_branches/list', { params: { project: pk } }); return r.data.branches || []; }
export async function listQualityGates(ctx) { const r = await ctx.client.get('/api/qualitygates/list', { params: { organization: ctx.organization } }); return r.data; }
export async function getQualityGateDetails(ctx, id) { const r = await ctx.client.get('/api/qualitygates/show', { params: { id, organization: ctx.organization } }); return r.data; }

export async function getQualityGateForProject(ctx, pk) {
  try {
    const r = await ctx.client.get('/api/qualitygates/get_by_project', { params: { project: pk, organization: ctx.organization } });
    return r.data.qualityGate || null;
  } catch (error) { logger.debug(`Failed to get quality gate for project ${pk}: ${error.message}`); return null; }
}

export async function getProjectMeasures(ctx, pk, metricKeys) { const r = await ctx.client.get('/api/measures/component', { params: { component: pk, metricKeys: metricKeys.join(',') } }); return r.data.component || {}; }
export async function getProjectSettings(ctx, pk) { const r = await ctx.client.get('/api/settings/values', { params: { component: pk } }); return r.data.settings || []; }
export async function getProjectLinks(ctx, pk) { const r = await ctx.client.get('/api/project_links/search', { params: { projectKey: pk } }); return r.data.links || []; }

export async function getProjectTagsForProject(ctx, pk) {
  try {
    const r = await ctx.client.get('/api/project_tags/search', { params: { project: pk, ps: 100 } });
    return r.data.tags || [];
  } catch (error) { logger.debug(`Failed to get project tags for ${pk}: ${error.message}`); return []; }
}
