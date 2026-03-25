import logger from '../../../../shared/utils/logger.js';

// -------- Resolve Project Name from SonarQube --------

export async function resolveProjectName(projectName, sonarQubeClient) {
  if (projectName) return projectName;

  try {
    const sqProject = await sonarQubeClient.getProject();
    return sqProject.name || null;
  } catch (error) {
    logger.warn(`Could not fetch project name from SonarQube: ${error.message}`);
    return null;
  }
}
