import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateQualityProfileDiff } from '../../../sonarcloud/migrators/quality-profile-diff.js';
import { migrateGlobalPermissions } from '../../../sonarcloud/migrators/permissions.js';
import { runOrgStep } from './run-org-step.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Org-Wide Batch 2 (Dependent Steps) --------

/** Run org-wide steps that depend on Batch 1 results. */
export async function migrateOrgWideBatch2(extractedData, scClient, sqClient, orgResult, results, ctx) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);

  const tasks = [
    shouldRun('permissions') ? runOrgStep(orgResult, 'Set global permissions', async () => {
      logger.info('Setting global permissions...');
      await migrateGlobalPermissions(extractedData.globalPermissions, scClient);
    }) : null,
    (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) ? null : runOrgStep(orgResult, 'Compare quality profiles', async () => {
      logger.info('Comparing quality profiles between SonarQube and SonarCloud...');
      const diffReport = await generateQualityProfileDiff(extractedData.qualityProfiles, sqClient, scClient);
      const diffPath = join(ctx.outputDir, 'quality-profiles', 'quality-profile-diff.json');
      await writeFile(diffPath, JSON.stringify(diffReport, null, 2));
      logger.info(`Quality profile diff report written to ${diffPath}`);
      return `${diffReport.summary.languagesCompared} languages compared, ${diffReport.summary.totalMissingRules} missing rules, ${diffReport.summary.totalAddedRules} added rules`;
    }),
  ].filter(Boolean);

  await Promise.all(tasks);
}
