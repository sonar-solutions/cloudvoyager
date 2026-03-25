// -------- Transfer Branch --------

import logger from '../../../shared/utils/logger.js';
import { buildAndEncodeReport } from './helpers/build-and-encode-report.js';
import { uploadReport } from './helpers/upload-report.js';
import { computeBranchStats } from './helpers/compute-branch-stats.js';

export async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  const encodedReport = buildAndEncodeReport({
    extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap, label
  });

  const metadata = {
    projectKey: sonarcloudConfig.projectKey,
    organization: sonarcloudConfig.organization,
    version: '1.0.0',
    ...(!isMainBranch && branchName ? { branchName } : {})
  };

  const ceTask = await uploadReport({ sonarCloudClient, encodedReport, metadata, wait, label });
  const stats = computeBranchStats(extractedData);

  return { stats, ceTask };
}
