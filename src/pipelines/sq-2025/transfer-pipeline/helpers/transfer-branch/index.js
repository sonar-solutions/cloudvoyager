import { buildProtobufMessages, encodeMessages } from './helpers/build-and-encode.js';
import { uploadReport } from './helpers/upload-report.js';
import { transferBatched } from './helpers/transfer-batched.js';
import { shouldBatch } from '../../../../../shared/utils/batch-distributor.js';

// -------- Branch Transfer --------

/** Build, encode, and upload a single branch report to SonarCloud. */
export async function transferBranch(options) {
  const {
    extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
    referenceBranchName, wait, sonarCloudClient, label,
    isMainBranch = false, sonarCloudRepos = new Set(),
    ruleEnrichmentMap = new Map(),
  } = options;

  if (shouldBatch(extractedData)) {
    const ceTask = await transferBatched({
      extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
      referenceBranchName, sonarCloudClient, label, isMainBranch,
      sonarCloudRepos, ruleEnrichmentMap,
    });
    return { stats: computeBranchStats(extractedData), ceTask };
  }

  const messages = buildProtobufMessages(extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap, label);
  const encodedReport = await encodeMessages(messages, label);
  const ceTask = await uploadReport(encodedReport, sonarcloudConfig, sonarCloudClient, branchName, isMainBranch, wait, label);

  return { stats: computeBranchStats(extractedData), ceTask };
}

function computeBranchStats(extractedData) {
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  const hotspotCount = extractedData.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;
  return {
    issuesTransferred: extractedData.issues.length - hotspotCount,
    hotspotsTransferred: hotspotCount,
    componentsTransferred: extractedData.components.length,
    sourcesTransferred: extractedData.sources.length,
    linesOfCode: nclocMeasure ? parseInt(nclocMeasure.value, 10) || 0 : 0,
  };
}
