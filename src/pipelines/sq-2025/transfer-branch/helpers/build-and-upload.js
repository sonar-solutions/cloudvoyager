import { ProtobufBuilder } from '../../protobuf/builder.js';
import { ProtobufEncoder } from '../../protobuf/encoder.js';
import { ReportUploader } from '../../sonarcloud/uploader.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Build and Upload --------

/** Build protobuf messages, encode, and upload to SonarCloud. */
export async function buildAndUpload(opts) {
  const { extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, sonarCloudRepos,
    ruleEnrichmentMap, isMainBranch, wait, sonarCloudClient, label } = opts;

  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName,
    referenceBranchName,
    sonarCloudRepos,
    ruleEnrichmentMap,
  });
  const messages = builder.buildAll();

  logger.info(`[${label}] Encoding to protobuf format...`);
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  const encodedReport = encoder.encodeAll(messages);

  logger.info(`[${label}] Uploading to SonarCloud...`);
  const uploader = new ReportUploader(sonarCloudClient);
  const metadata = {
    projectKey: sonarcloudConfig.projectKey,
    organization: sonarcloudConfig.organization,
    version: '1.0.0',
    ...(!isMainBranch && branchName ? { branchName } : {}),
  };

  if (wait) {
    const ceTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
    return ceTask;
  }

  const ceTask = await uploader.upload(encodedReport, metadata);
  logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  return ceTask;
}
