import logger from '../../../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../../sonarcloud/api-client.js';
import { diffAllRules } from './diff-all-rules.js';

// -------- Gather Rules Comparison --------

/** Fetch all rules from both SQ and SC, compare by Rule ID. */
export async function gatherRulesComparison(ctx) {
  if (!ctx.sonarcloudOrgs?.length) return null;

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
  const firstOrg = ctx.sonarcloudOrgs[0];
  const scClient = new SonarCloudClient({ url: firstOrg.url || 'https://sonarcloud.io', token: firstOrg.token, organization: firstOrg.key });

  logger.info('Fetching all rules from SonarQube and SonarCloud...');
  const [sqRules, scRules] = await Promise.all([
    sqClient.getAllRules(),
    scClient.getAllRules(),
  ]);

  logger.info(`SonarQube: ${sqRules.length} rules | SonarCloud: ${scRules.length} rules`);
  const { onlyInSQ, onlyInSC, inBothCount } = diffAllRules(sqRules, scRules);
  logger.info(`Rules diff: ${onlyInSQ.length} only in SQ, ${onlyInSC.length} only in SC, ${inBothCount} in both`);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      sqTotalRules: sqRules.length, scTotalRules: scRules.length,
      onlyInSQCount: onlyInSQ.length, onlyInSCCount: onlyInSC.length, inBothCount,
    },
    onlyInSQ,
    onlyInSC,
  };
}
