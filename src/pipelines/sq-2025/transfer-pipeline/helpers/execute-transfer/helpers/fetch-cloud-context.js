import logger from '../../../../../../shared/utils/logger.js';

// -------- Fetch SonarCloud Context --------

/** Fetch project name, profiles, main branch, and rule repos from SonarCloud. */
export async function fetchCloudContext(sonarQubeClient, sonarCloudClient, initialProjectName) {
  let projectName = initialProjectName;
  if (!projectName) {
    try { projectName = (await sonarQubeClient.getProject()).name || null; }
    catch (error) { logger.warn(`Could not fetch project name: ${error.message}`); }
  }
  await sonarCloudClient.ensureProject(projectName);

  const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
  const sonarCloudMainBranch = await sonarCloudClient.getMainBranchName();
  const sonarCloudRepos = await sonarCloudClient.getRuleRepositories();

  return { sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos };
}
