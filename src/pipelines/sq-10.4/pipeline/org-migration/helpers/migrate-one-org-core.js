import { SonarQubeClient } from '../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../sonarcloud/api-client.js';
import { migrateOrgProjectsCorePhase, resolveProjectKey } from '../../project-migration.js';
import { loadOrMigrateOrgWide } from './load-or-migrate-org-wide.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

export async function migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx) {
  const { org, projects } = assignment;
  if (projects.length === 0) { logger.info(`Skipping org ${org.key}: no projects`); return null; }

  logger.info(`\n=== Migrating to organization: ${org.key} (${projects.length} projects) ===`);
  const orgStart = Date.now();
  const orgResult = { key: org.key, projectCount: projects.length, steps: [] };
  results.orgResults.push(orgResult);
  const migrationJournal = ctx.migrationJournal || null;
  if (migrationJournal) await migrationJournal.ensureOrg(org.key);

  const scClient = new SonarCloudClient({ url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, rateLimit: ctx.rateLimitConfig });
  try { await scClient.testConnection(); orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'success' }); }
  catch (e) { orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'failed', error: e.message }); return null; }

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
  const { gateMapping, builtInProfileMapping } = await loadOrMigrateOrgWide(org, extractedData, scClient, sqClient, orgResult, results, ctx, migrationJournal);

  const sharedThrottler = { _lastPostTime: 0 };
  const only = ctx.onlyComponents;
  const PROJECT_COMPS = ['scan-data', 'scan-data-all-branches', 'quality-gates', 'quality-profiles', 'permissions', 'issue-metadata', 'hotspot-metadata', 'project-settings'];
  let projectKeyMap = new Map(), projectKeyWarnings = [], projectPhase2Contexts = [];

  if (!only || PROJECT_COMPS.some(c => only.includes(c))) {
    const r = await migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, { ...ctx, sharedThrottler }, builtInProfileMapping);
    projectKeyMap = r.projectKeyMap; projectKeyWarnings = r.projectKeyWarnings; projectPhase2Contexts = r.projectPhase2Contexts;
  } else {
    for (const p of projects) { const { scProjectKey } = await resolveProjectKey(p, org, scClient); projectKeyMap.set(p.key, scProjectKey); }
    logger.info(`Skipping project migration. Resolved ${projectKeyMap.size} project key(s).`);
  }
  results.projectKeyWarnings.push(...projectKeyWarnings);
  return { projectKeyMap, orgPhase2Context: { org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts } };
}
