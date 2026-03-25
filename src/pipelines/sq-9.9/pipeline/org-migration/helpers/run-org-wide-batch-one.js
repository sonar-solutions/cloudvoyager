import { migrateQualityGates } from '../../../sonarcloud/migrators/quality-gates.js';
import { migrateQualityProfiles } from '../../../sonarcloud/migrators/quality-profiles.js';
import { migrateGroups } from '../../../sonarcloud/migrators/groups.js';
import { migratePermissionTemplates } from '../../../sonarcloud/migrators/permissions.js';
import { runOrgStep } from './run-org-step.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Org-Wide Batch 1: Independent Steps (parallel) --------

export async function runOrgWideBatchOne(extractedData, scClient, orgResult, results, shouldRun, ctx) {
  let gateMapping = new Map();
  let builtInProfileMapping = new Map();

  await Promise.all([
    shouldRun('permissions') ? runOrgStep(orgResult, 'Create groups', async () => {
      logger.info('Creating groups...');
      const groupMapping = await migrateGroups(extractedData.groups, scClient);
      results.groups += groupMapping.size;
      return `${groupMapping.size} created`;
    }) : null,
    shouldRun('quality-gates') ? runOrgStep(orgResult, 'Create quality gates', async () => {
      logger.info('Creating quality gates...');
      gateMapping = await migrateQualityGates(extractedData.qualityGates, scClient);
      results.qualityGates += gateMapping.size;
      return `${gateMapping.size} created`;
    }) : null,
    (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) ? null : runOrgStep(orgResult, 'Restore quality profiles', async () => {
      logger.info('Restoring quality profiles...');
      const r = await migrateQualityProfiles(extractedData.qualityProfiles, scClient);
      builtInProfileMapping = r.builtInProfileMapping;
      results.qualityProfiles += r.profileMapping.size;
      return `${r.profileMapping.size} restored (${builtInProfileMapping.size} built-in migrated)`;
    }),
    shouldRun('permission-templates') ? runOrgStep(orgResult, 'Create permission templates', async () => {
      logger.info('Creating permission templates...');
      await migratePermissionTemplates(extractedData.permissionTemplates, scClient);
    }) : null,
  ].filter(Boolean));

  return { gateMapping, builtInProfileMapping };
}
