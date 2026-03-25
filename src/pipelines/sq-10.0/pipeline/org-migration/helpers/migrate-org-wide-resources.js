import logger from '../../../../../shared/utils/logger.js';
import { runBatch1 } from './migrate-org-wide-batch1.js';
import { runBatch2 } from './migrate-org-wide-batch2.js';

// -------- Migrate Org-Wide Resources --------

export async function migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx) {
  const only = ctx.onlyComponents;
  const shouldRun = (comp) => !only || only.includes(comp);
  pushSkippedSteps(orgResult, shouldRun, ctx);
  const { gateMapping, builtInProfileMapping } = await runBatch1(extractedData, scClient, orgResult, results, ctx);
  await runBatch2(extractedData, scClient, sqClient, orgResult, ctx);
  return { gateMapping, builtInProfileMapping };
}

function pushSkippedSteps(orgResult, shouldRun, ctx) {
  if (!shouldRun('permissions')) {
    orgResult.steps.push({ step: 'Create groups', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    orgResult.steps.push({ step: 'Set global permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
  if (!shouldRun('quality-gates')) {
    orgResult.steps.push({ step: 'Create quality gates', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
  if (!shouldRun('quality-profiles') || ctx.skipQualityProfileSync) {
    const reason = !shouldRun('quality-profiles') ? 'Not included in --only' : 'Disabled by --skip-quality-profile-sync';
    orgResult.steps.push({ step: 'Restore quality profiles', status: 'skipped', detail: reason, durationMs: 0 });
    orgResult.steps.push({ step: 'Compare quality profiles', status: 'skipped', detail: reason, durationMs: 0 });
    if (ctx.skipQualityProfileSync && shouldRun('quality-profiles')) {
      logger.info('Skipping quality profile sync (--skip-quality-profile-sync). Projects will use default SonarCloud profiles.');
    }
  }
  if (!shouldRun('permission-templates')) {
    orgResult.steps.push({ step: 'Create permission templates', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
}
