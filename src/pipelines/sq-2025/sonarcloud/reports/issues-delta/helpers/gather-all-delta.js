import logger from '../../../../../../shared/utils/logger.js';
import { SonarQubeClient } from '../../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../../sonarcloud/api-client.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency.js';
import { gatherProjectDelta } from './gather-project-delta.js';

// -------- Gather All Issues Delta --------

/**
 * Gather post-migration issues delta for all non-failed projects.
 * NOTE: Uses ctx.sonarcloudOrgs[0] for SC client — single-org migrations only in v1.
 */
export async function gatherAllDelta(results, ctx) {
  if (!ctx.sonarcloudOrgs?.length) return null;

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
  const firstOrg = ctx.sonarcloudOrgs[0];
  const scClient = new SonarCloudClient({ url: firstOrg.url || 'https://sonarcloud.io', token: firstOrg.token, organization: firstOrg.key });

  const eligible = (results.projects || []).filter(p => p.status !== 'failed');
  logger.info(`Gathering issues delta for ${eligible.length} projects...`);

  const settled = await mapConcurrent(
    eligible,
    async (project) => {
      const scKey = ctx.projectKeyMap?.get(project.key) || project.key;
      return gatherProjectDelta(project.key, scKey, sqClient, scClient);
    },
    { concurrency: 3, settled: true },
  );

  const projects = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
  const totalDisappeared = projects.reduce((sum, p) => sum + p.onlyInSQ.length, 0);
  const totalAppeared = projects.reduce((sum, p) => sum + p.onlyInSC.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: { projectsCompared: projects.length, totalDisappeared, totalAppeared },
    projects,
  };
}
