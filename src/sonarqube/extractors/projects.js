import logger from '../../utils/logger.js';
import { ProjectData } from '../models.js';

/**
 * Extract project data from SonarQube
 */
export async function extractProjectData(client) {
  logger.info('Extracting project data...');

  const projectData = new ProjectData();

  // Get project info
  projectData.project = await client.getProject();
  logger.info(`Project: ${projectData.project.name} (${projectData.project.key})`);

  // Get branches
  projectData.branches = await client.getBranches();
  logger.info(`Found ${projectData.branches.length} branches`);

  // Get quality gate
  projectData.qualityGate = await client.getQualityGate();
  if (projectData.qualityGate) {
    logger.info(`Quality Gate: ${projectData.qualityGate.name}`);
  }

  return projectData;
}
