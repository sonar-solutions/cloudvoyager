import { randomBytes } from 'node:crypto';
import logger from '../../../../../shared/utils/logger.js';

// -------- Build Metadata --------

/** Build the analysis metadata message. */
export function buildMetadata(inst) {
  const project = inst.data.project.project;
  const sqBranch = inst.data.project.branches.find(b => b.isMain) || inst.data.project.branches[0];
  const branchName = inst.sonarCloudBranchName || sqBranch?.name || 'master';
  const referenceBranch = inst.referenceBranchName || branchName;

  const metadata = {
    analysisDate: new Date(inst.data.metadata.extractedAt).getTime(),
    organizationKey: inst.sonarCloudConfig.organization || '',
    projectKey: inst.sonarCloudConfig.projectKey || project.key,
    rootComponentRef: inst.getComponentRef(project.key),
    crossProjectDuplicationActivated: false,
    qprofilesPerLanguage: inst.buildQProfiles(),
    branchName, branchType: 1, referenceBranchName: referenceBranch,
    scmRevisionId: inst.data.metadata.scmRevisionId || randomBytes(20).toString('hex'),
    projectVersion: '1.0.0',
    analyzedIndexedFileCountPerType: inst.buildFileCountsByType(),
  };

  logger.debug(`Metadata built: projectKey=${metadata.projectKey}, branch=${metadata.branchName}, scmRevisionId=${metadata.scmRevisionId}`);
  return metadata;
}
