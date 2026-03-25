import logger from '../../../../../../shared/utils/logger.js';

// -------- Get Main Branch Name --------

/** Fetch the main branch name from SonarCloud for a project. */
export async function getMainBranchName(client, projectKey) {
  try {
    logger.info('Fetching main branch name from SonarCloud...');
    const response = await client.get('/api/project_branches/list', { params: { project: projectKey } });
    const branches = response.data.branches || [];
    const mainBranch = branches.find(b => b.isMain);
    const branchName = mainBranch?.name || 'master';
    logger.info(`SonarCloud main branch: ${branchName}`);
    return branchName;
  } catch (error) {
    logger.warn(`Failed to fetch branch name from SonarCloud: ${error.message}, defaulting to 'master'`);
    return 'master';
  }
}
