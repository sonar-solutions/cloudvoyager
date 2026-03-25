import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build the metadata message for the scanner report.
export function buildMetadata(instance) {
  const project = instance.data.project.project;
  const sqBranch = instance.data.project.branches.find(b => b.isMain) || instance.data.project.branches[0];
  const branchName = instance.sonarCloudBranchName || sqBranch?.name || 'master';
  const referenceBranch = instance.referenceBranchName || branchName;
  const metadata = {
    analysisDate: new Date(instance.data.metadata.extractedAt).getTime(),
    organizationKey: instance.sonarCloudConfig.organization || '',
    projectKey: instance.sonarCloudConfig.projectKey || project.key,
    rootComponentRef: instance.getComponentRef(project.key),
    crossProjectDuplicationActivated: false,
    qprofilesPerLanguage: instance.buildQProfiles(),
    branchName, branchType: 1, referenceBranchName: referenceBranch,
    scmRevisionId: instance.data.metadata.scmRevisionId || instance.generateFakeCommitHash(),
    projectVersion: '1.0.0',
    analyzedIndexedFileCountPerType: instance.buildFileCountsByType(),
  };
  logger.debug(`Metadata built: projectKey=${metadata.projectKey}, branch=${metadata.branchName}, scmRevisionId=${metadata.scmRevisionId}`);
  return metadata;
}
