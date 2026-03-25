import logger from '../../../../../../shared/utils/logger.js';

// -------- Resolve Portfolio Projects --------

/** Resolve a portfolio's projects to SonarCloud UUIDs. */
export function resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap) {
  if (portfolio.selectionMode === 'REST') {
    const allProjects = [...projectUuidMap.values()].map(u => ({ id: u.id, branchId: u.branchId }));
    logger.info(`Portfolio "${portfolio.name}" uses "all projects" mode — including all ${allProjects.length} selectable projects`);
    return allProjects;
  }

  const resolvedProjects = [];
  for (const project of portfolio.projects) {
    const scProjectKey = projectKeyMapping.get(project.key) || project.key;
    const uuids = projectUuidMap.get(scProjectKey);
    if (uuids) {
      resolvedProjects.push({ id: uuids.id, branchId: uuids.branchId });
    } else {
      logger.debug(`Portfolio "${portfolio.name}": project "${scProjectKey}" not found in SonarCloud — skipping`);
    }
  }
  return resolvedProjects;
}
