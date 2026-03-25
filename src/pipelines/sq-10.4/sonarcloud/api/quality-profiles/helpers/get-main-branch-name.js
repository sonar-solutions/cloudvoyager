import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch main branch name from SonarCloud.
export async function getMainBranchName(client, projectKey) {
  try {
    logger.info('Fetching main branch name from SonarCloud...');
    const response = await client.get('/api/project_branches/list', { params: { project: projectKey } });
    const branches = response.data.branches || [];
    const branchName = branches.find(b => b.isMain)?.name || 'master';
    logger.info(`SonarCloud main branch: ${branchName}`);
    return branchName;
  } catch (error) {
    logger.warn(`Failed to fetch branch name from SonarCloud: ${error.message}, defaulting to 'master'`);
    return 'master';
  }
}
