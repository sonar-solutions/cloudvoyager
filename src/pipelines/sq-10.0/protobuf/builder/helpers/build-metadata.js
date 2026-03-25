import { randomBytes } from 'node:crypto';
import logger from '../../../../../shared/utils/logger.js';

// -------- Metadata Builder --------

export function buildMetadata(ctx) {
  const project = ctx.data.project.project;
  const sqBranch = ctx.data.project.branches.find(b => b.isMain) || ctx.data.project.branches[0];
  const branchName = ctx.sonarCloudBranchName || sqBranch?.name || 'master';
  const referenceBranch = ctx.referenceBranchName || branchName;
  const metadata = {
    analysisDate: new Date(ctx.data.metadata.extractedAt).getTime(),
    organizationKey: ctx.sonarCloudConfig.organization || '',
    projectKey: ctx.sonarCloudConfig.projectKey || project.key,
    rootComponentRef: ctx.getComponentRef(project.key),
    crossProjectDuplicationActivated: false,
    qprofilesPerLanguage: ctx.buildQProfiles(),
    branchName, branchType: 1,
    referenceBranchName: referenceBranch,
    scmRevisionId: ctx.data.metadata.scmRevisionId || generateFakeCommitHash(),
    projectVersion: '1.0.0',
    analyzedIndexedFileCountPerType: ctx.buildFileCountsByType(),
  };
  logger.debug(`Metadata built: projectKey=${metadata.projectKey}, branch=${metadata.branchName}, scmRevisionId=${metadata.scmRevisionId}`);
  return metadata;
}

function generateFakeCommitHash() {
  const hash = randomBytes(20).toString('hex');
  logger.debug(`Generated fake commit hash: ${hash}`);
  return hash;
}
