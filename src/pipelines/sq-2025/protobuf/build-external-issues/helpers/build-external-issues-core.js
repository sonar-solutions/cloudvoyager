import logger from '../../../../../shared/utils/logger.js';
import { processOneIssue } from './process-one-issue.js';
import { logExternalIssueStats } from './log-external-issue-stats.js';

// -------- Build External Issues (Core) --------

/** Build ExternalIssue protobuf messages and collect AdHocRule definitions. */
export function buildExternalIssues(builder) {
  const sonarCloudRepos = builder.sonarCloudRepos;

  if (!sonarCloudRepos || sonarCloudRepos.size === 0) {
    logger.debug('No SonarCloud repositories available — skipping external issue auto-detection');
    return { externalIssuesByComponent: new Map(), adHocRules: [] };
  }

  logger.info('Auto-detecting external issues (rule repos not in SonarCloud)...');

  const ctx = {
    sonarCloudRepos,
    ruleEnrichmentMap: builder.ruleEnrichmentMap || new Map(),
    externalIssuesByComponent: new Map(),
    adHocRules: new Map(),
    detectedEngines: new Set(),
    skippedIssues: 0,
    enrichedCount: 0,
  };

  builder.data.issues.forEach(issue => processOneIssue(issue, builder, ctx));

  logExternalIssueStats(ctx.externalIssuesByComponent, ctx.adHocRules, ctx.detectedEngines, ctx.skippedIssues, ctx.enrichedCount);

  return { externalIssuesByComponent: ctx.externalIssuesByComponent, adHocRules: [...ctx.adHocRules.values()] };
}
