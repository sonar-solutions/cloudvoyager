import { mapConcurrent } from '../../../../../shared/utils/concurrency.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Extract branches for all projects concurrently.
export async function extractAllProjectBranches(sqClient, allProjects, perfConfig) {
  const concurrency = perfConfig.maxConcurrency || 10;
  logger.info(`Extracting branches for ${allProjects.length} projects (concurrency=${concurrency})...`);

  const results = await mapConcurrent(allProjects, async (project) => {
    const branches = await sqClient.getBranches(project.key);
    return { key: project.key, branches };
  }, { concurrency, settled: true });

  const branchMap = new Map();
  for (const r of results) {
    if (r.status === 'fulfilled') branchMap.set(r.value.key, r.value.branches);
    else logger.warn(`Failed to fetch branches for a project: ${r.reason?.message}`);
  }

  logger.info(`Extracted branches for ${branchMap.size}/${allProjects.length} projects`);
  return branchMap;
}
