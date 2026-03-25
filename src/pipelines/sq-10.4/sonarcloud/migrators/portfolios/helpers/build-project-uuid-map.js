import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build a map of SC project key -> { id, branchId } using a temporary portfolio.
export async function buildProjectUuidMap(client, enterpriseId) {
  const projectUuidMap = new Map();
  const tempPortfolio = await client.createPortfolio({
    name: `_cloudvoyager_temp_lookup_${Date.now()}`, enterpriseId,
    description: 'Temporary portfolio for UUID resolution (will be deleted)', selection: 'projects'
  });

  try {
    const orgs = await client.getSelectableOrganizations(tempPortfolio.id);
    logger.debug(`Found ${orgs.length} selectable organizations for project UUID resolution`);
    for (const org of orgs) {
      const projects = await client.getSelectableProjects(tempPortfolio.id, org.id);
      for (const project of projects) {
        projectUuidMap.set(project.projectKey, { id: project.id, branchId: project.branchId });
      }
      logger.debug(`Resolved ${projects.length} project UUIDs from org "${org.name}"`);
    }
  } finally {
    await client.deletePortfolio(tempPortfolio.id);
    logger.debug('Deleted temporary lookup portfolio');
  }

  logger.info(`Resolved ${projectUuidMap.size} project UUIDs for portfolio migration`);
  return projectUuidMap;
}
