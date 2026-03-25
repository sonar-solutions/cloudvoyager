import { ProtobufBuilder } from '../../protobuf/builder.js';
import { ProtobufEncoder } from '../../protobuf/encoder.js';
import { ReportUploader } from '../../sonarcloud/uploader.js';
import { computeBranchStats } from './compute-branch-stats.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Build, encode, and upload a single branch report to SonarCloud.
 *
 * @param {object} options - Transfer options
 * @returns {Promise<object>} { stats, ceTask }
 */
export async function transferBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, wait, sonarCloudClient, label, isMainBranch = false, sonarCloudRepos = new Set(), ruleEnrichmentMap = new Map() }) {
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap,
  });
  const messages = builder.buildAll();

  logger.info(`[${label}] Encoding to protobuf format...`);
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  const encodedReport = encoder.encodeAll(messages);

  logger.info(`[${label}] Uploading to SonarCloud...`);
  const uploader = new ReportUploader(sonarCloudClient);
  const metadata = {
    projectKey: sonarcloudConfig.projectKey, organization: sonarcloudConfig.organization,
    version: '1.0.0', ...(!isMainBranch && branchName ? { branchName } : {}),
  };

  let ceTask;
  if (wait) {
    ceTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
  } else {
    ceTask = await uploader.upload(encodedReport, metadata);
    logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  }

  return { stats: computeBranchStats(extractedData), ceTask };
}
