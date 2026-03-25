import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { migrateQualityGates } from '../../../sonarcloud/migrators/quality-gates.js';
import { migrateQualityProfiles } from '../../../sonarcloud/migrators/quality-profiles.js';
import { generateQualityProfileDiff } from '../../../sonarcloud/migrators/quality-profile-diff.js';
import { migrateGroups } from '../../../sonarcloud/migrators/groups.js';
import { migrateGlobalPermissions, migratePermissionTemplates } from '../../../sonarcloud/migrators/permissions.js';
import { runOrgStep } from './run-org-step.js';
import { pushSkippedSteps } from './migrate-org-wide-skips.js';

// -------- Main Logic --------

export async function migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);
  let gateMapping = new Map(), builtInProfileMapping = new Map();
  pushSkippedSteps(orgResult, ctx);

  await Promise.all([
    shouldRun('permissions') ? runOrgStep(orgResult, 'Create groups', async () => {
      const gm = await migrateGroups(extractedData.groups, scClient);
      results.groups += gm.size; return `${gm.size} created`;
    }) : null,
    shouldRun('quality-gates') ? runOrgStep(orgResult, 'Create quality gates', async () => {
      gateMapping = await migrateQualityGates(extractedData.qualityGates, scClient);
      results.qualityGates += gateMapping.size; return `${gateMapping.size} created`;
    }) : null,
    (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) ? null : runOrgStep(orgResult, 'Restore quality profiles', async () => {
      const r = await migrateQualityProfiles(extractedData.qualityProfiles, scClient);
      builtInProfileMapping = r.builtInProfileMapping; results.qualityProfiles += r.profileMapping.size;
      return `${r.profileMapping.size} restored (${builtInProfileMapping.size} built-in)`;
    }),
    shouldRun('permission-templates') ? runOrgStep(orgResult, 'Create permission templates', async () => {
      await migratePermissionTemplates(extractedData.permissionTemplates, scClient);
    }) : null,
  ].filter(Boolean));

  await Promise.all([
    shouldRun('permissions') ? runOrgStep(orgResult, 'Set global permissions', async () => {
      await migrateGlobalPermissions(extractedData.globalPermissions, scClient);
    }) : null,
    (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) ? null : runOrgStep(orgResult, 'Compare quality profiles', async () => {
      const diff = await generateQualityProfileDiff(extractedData.qualityProfiles, sqClient, scClient);
      await writeFile(join(ctx.outputDir, 'quality-profiles', 'quality-profile-diff.json'), JSON.stringify(diff, null, 2));
      return `${diff.summary.languagesCompared} languages, ${diff.summary.totalMissingRules} missing, ${diff.summary.totalAddedRules} added`;
    }),
  ].filter(Boolean));

  return { gateMapping, builtInProfileMapping };
}
