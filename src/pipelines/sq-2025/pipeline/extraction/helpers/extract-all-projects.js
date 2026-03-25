import logger from '../../../../../shared/utils/logger.js';

// -------- Extract All Projects --------

/** Extract all projects from SonarQube. */
export async function extractAllProjects(sqClient, results) {
  try {
    logger.info('Extracting all projects...');
    const allProjects = await sqClient.listAllProjects();
    logger.info(`Found ${allProjects.length} projects`);
    results.serverSteps.push({ step: 'Extract projects', status: 'success', detail: `${allProjects.length} found` });
    return allProjects;
  } catch (error) {
    results.serverSteps.push({ step: 'Extract projects', status: 'failed', error: error.message });
    throw error;
  }
}
