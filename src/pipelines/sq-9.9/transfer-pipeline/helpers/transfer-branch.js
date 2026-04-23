import { buildProtobufMessages } from './build-protobuf-messages.js';
import { encodeReport } from './encode-report.js';
import { uploadReport } from './upload-report.js';
import { buildBranchResult } from './build-branch-result.js';
import { transferBranchBatched } from './transfer-branch-batched.js';
import { shouldBatch, backdateChangesets } from '../../../../shared/utils/batch-distributor.js';

// -------- Single Branch Transfer (build, encode, upload) --------

export async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  if (shouldBatch(extractedData)) {
    const ceTask = await transferBranchBatched({
      extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
      referenceBranchName, sonarCloudClient, label, isMainBranch,
      sonarCloudRepos, ruleEnrichmentMap,
    });
    return buildBranchResult(extractedData, ceTask);
  }

  backdateChangesets(extractedData);

  const messages = buildProtobufMessages(extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap, label);
  const encodedReport = await encodeReport(messages, label);
  const ceTask = await uploadReport(encodedReport, sonarcloudConfig, sonarCloudClient, branchName, isMainBranch, wait, label);
  return buildBranchResult(extractedData, ceTask);
}
