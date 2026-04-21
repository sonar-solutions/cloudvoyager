import { buildAndUpload } from './helpers/build-and-upload.js';
import { buildAndUploadBatched } from './helpers/build-and-upload-batched.js';
import { computeBranchStats } from './helpers/compute-branch-stats.js';
import { shouldBatch } from '../../../shared/utils/batch-distributor.js';

// -------- Transfer Branch --------

/** Build, encode, and upload a single branch report to SonarCloud. */
export async function transferBranch(options) {
  const { extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, wait, sonarCloudClient,
    label, isMainBranch = false, sonarCloudRepos = new Set(),
    ruleEnrichmentMap = new Map() } = options;

  const uploadOpts = {
    extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, sonarCloudRepos,
    ruleEnrichmentMap, isMainBranch, wait, sonarCloudClient, label,
  };

  const ceTask = shouldBatch(extractedData)
    ? await buildAndUploadBatched(uploadOpts)
    : await buildAndUpload(uploadOpts);

  return { stats: computeBranchStats(extractedData), ceTask };
}
