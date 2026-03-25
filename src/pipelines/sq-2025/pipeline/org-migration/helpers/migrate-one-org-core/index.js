import { SonarQubeClient } from '../../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../../sonarcloud/api-client.js';
import { loadCachedMappings } from '../load-cached-mappings.js';
import { migrateOrgProjects } from './helpers/migrate-org-projects.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate One Organization Core --------

/** Phase 1: Org-wide resources + project upload/config. */
export async function migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx) {
  const { org, projects } = assignment;
  if (projects.length === 0) { logger.info(`Skipping org ${org.key}: no projects assigned`); return null; }

  logger.info(`\n========================================\n=== Migrating to organization: ${org.key} (${projects.length} projects) ===\n========================================`);

  const orgStart = Date.now();
  const orgResult = { key: org.key, projectCount: projects.length, steps: [] };
  results.orgResults.push(orgResult);

  const migrationJournal = ctx.migrationJournal || null;
  if (migrationJournal) await migrationJournal.ensureOrg(org.key);

  const scClient = new SonarCloudClient({ url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, rateLimit: ctx.rateLimitConfig });
  try { await scClient.testConnection(); orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'success' }); }
  catch (error) { orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'failed', error: error.message }); logger.error(`Failed to connect to SC org ${org.key}: ${error.message}`); return null; }

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });

  const { gateMapping, builtInProfileMapping } = await loadCachedMappings(org, migrationJournal, ctx, orgResult, results, extractedData, scClient, sqClient);

  const { projectKeyMap, projectKeyWarnings, projectPhase2Contexts } = await migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping);

  results.projectKeyWarnings.push(...projectKeyWarnings);
  return { projectKeyMap, orgPhase2Context: { org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts } };
}
