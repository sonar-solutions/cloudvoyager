import { ProtobufBuilder } from './protobuf/builder.js';
import { ProtobufEncoder } from './protobuf/encoder.js';
import { ReportUploader } from './sonarcloud/uploader.js';
import logger from '../../shared/utils/logger.js';

/**
 * Build, encode, and upload a single branch report to SonarCloud.
 *
 * @param {object} options
 * @param {object} options.extractedData - Data from extractAll() or extractBranch()
 * @param {object} options.sonarcloudConfig - SonarCloud config
 * @param {Array}  options.sonarCloudProfiles - SonarCloud quality profiles
 * @param {string} options.branchName - Branch name to set in metadata
 * @param {string} options.referenceBranchName - Reference (main) branch name
 * @param {boolean} options.wait - Whether to wait for analysis completion
 * @param {object} options.sonarCloudClient - SonarCloud API client
 * @param {string} options.label - Human-readable label for logging
 * @returns {Promise<object>} { stats, ceTask } — branch transfer stats and the CE task object
 */
export async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  // Build protobuf messages
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName,
    referenceBranchName,
    sonarCloudRepos,
    ruleEnrichmentMap,
  });
  const messages = builder.buildAll();

  // Encode to protobuf format
  logger.info(`[${label}] Encoding to protobuf format...`);
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  const encodedReport = encoder.encodeAll(messages);

  // Upload to SonarCloud
  logger.info(`[${label}] Uploading to SonarCloud...`);
  const uploader = new ReportUploader(sonarCloudClient);
  const metadata = {
    projectKey: sonarcloudConfig.projectKey,
    organization: sonarcloudConfig.organization,
    version: '1.0.0',
    // Branch name — used by CE endpoint to route analysis to the correct branch.
    // For non-main branches, the uploader sends branch characteristics to the CE endpoint.
    ...(!isMainBranch && branchName ? { branchName } : {})
  };

  let ceTask;
  if (wait) {
    ceTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
  } else {
    ceTask = await uploader.upload(encodedReport, metadata);
    logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  }

  // Compute stats for this branch
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  const hotspotCount = extractedData.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;
  return {
    stats: {
      issuesTransferred: extractedData.issues.length - hotspotCount,
      hotspotsTransferred: hotspotCount,
      componentsTransferred: extractedData.components.length,
      sourcesTransferred: extractedData.sources.length,
      linesOfCode: nclocMeasure ? parseInt(nclocMeasure.value, 10) || 0 : 0
    },
    ceTask
  };
}
