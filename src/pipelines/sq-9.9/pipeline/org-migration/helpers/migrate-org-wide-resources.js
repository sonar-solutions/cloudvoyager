import logger from '../../../../../shared/utils/logger.js';
import { pushSkippedSteps } from './push-skipped-steps.js';
import { runOrgWideBatchOne } from './run-org-wide-batch-one.js';
import { runOrgWideBatchTwo } from './run-org-wide-batch-two.js';

// -------- Migrate Org-Wide Resources (groups, gates, profiles, templates) --------

export async function migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);

  pushSkippedSteps(orgResult, shouldRun, ctx);

  if (ctx.skipQualityProfileSync && shouldRun('quality-profiles')) {
    logger.info('Skipping quality profile sync (--skip-quality-profile-sync). Projects will use default SonarCloud profiles.');
  }

  const { gateMapping, builtInProfileMapping } = await runOrgWideBatchOne(extractedData, scClient, orgResult, results, shouldRun, ctx);
  await runOrgWideBatchTwo(extractedData, scClient, sqClient, orgResult, ctx, shouldRun);

  return { gateMapping, builtInProfileMapping };
}
