import { buildAndEncodeReport } from './build-and-encode-report.js';
import { uploadReport } from './upload-report.js';
import { computeBranchStats } from './compute-branch-stats.js';
import { transferBranchBatched } from './transfer-branch-batched.js';
import { shouldBatch } from '../../../../shared/utils/batch-distributor.js';

// -------- Main Logic --------

// Build, encode, and upload a single branch report to SonarCloud.
export async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  if (shouldBatch(extractedData)) {
    const ceTask = await transferBranchBatched({
      extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
      referenceBranchName, sonarCloudClient, label, isMainBranch,
      sonarCloudRepos, ruleEnrichmentMap,
    });
    return { stats: computeBranchStats(extractedData), ceTask };
  }

  const encodedReport = await buildAndEncodeReport({
    extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, label, sonarCloudRepos, ruleEnrichmentMap
  });

  const ceTask = await uploadReport({
    encodedReport, sonarcloudConfig, sonarCloudClient,
    branchName, isMainBranch, wait, label
  });

  return { stats: computeBranchStats(extractedData), ceTask };
}
