import { buildProtobufMessages } from './build-protobuf-messages.js';
import { encodeReport } from './encode-report.js';
import { uploadReport } from './upload-report.js';
import { buildBranchResult } from './build-branch-result.js';

// -------- Single Branch Transfer (build, encode, upload) --------

export async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  const messages = buildProtobufMessages(extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap, label);
  const encodedReport = await encodeReport(messages, label);
  const ceTask = await uploadReport(encodedReport, sonarcloudConfig, sonarCloudClient, branchName, isMainBranch, wait, label);
  return buildBranchResult(extractedData, ceTask);
}
