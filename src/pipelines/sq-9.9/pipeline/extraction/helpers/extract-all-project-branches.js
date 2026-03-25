import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../shared/utils/concurrency.js';

// -------- Extract Branches for All Projects --------

export async function extractAllProjectBranches(sqClient, allProjects, perfConfig) {
  const concurrency = perfConfig.maxConcurrency || 10;
  logger.info(`Extracting branches for ${allProjects.length} projects (concurrency=${concurrency})...`);

  const results = await mapConcurrent(
    allProjects,
    async (project) => ({ key: project.key, branches: await sqClient.getBranches(project.key) }),
    { concurrency, settled: true },
  );

  const branchMap = new Map();
  for (const r of results) {
    if (r.status === 'fulfilled') branchMap.set(r.value.key, r.value.branches);
    else logger.warn(`Failed to fetch branches for a project: ${r.reason?.message}`);
  }

  logger.info(`Extracted branches for ${branchMap.size}/${allProjects.length} projects`);
  return branchMap;
}
