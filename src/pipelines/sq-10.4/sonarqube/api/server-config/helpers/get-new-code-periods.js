import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch new code periods (project-level and branch overrides) from SonarQube.
export async function getNewCodePeriods(client, projectKey) {
  logger.info(`Fetching new code periods for: ${projectKey}`);
  let projectLevel = null;
  let branchOverrides = [];

  try {
    const response = await client.get('/api/new_code_periods/show', { params: { project: projectKey } });
    projectLevel = response.data;
  } catch (error) {
    logger.debug(`No project-level new code period for ${projectKey}: ${error.message}`);
  }

  try {
    const response = await client.get('/api/new_code_periods/list', { params: { project: projectKey } });
    branchOverrides = response.data.newCodePeriods || [];
  } catch (error) {
    logger.debug(`Failed to get branch-level new code periods for ${projectKey}: ${error.message}`);
  }

  return { projectLevel, branchOverrides };
}
