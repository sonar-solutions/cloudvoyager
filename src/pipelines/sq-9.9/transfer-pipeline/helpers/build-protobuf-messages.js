import { ProtobufBuilder } from '../../protobuf/builder.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Build Protobuf Messages --------

export function buildProtobufMessages(extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap, label) {
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(extractedData, sonarcloudConfig, sonarCloudProfiles, {
    sonarCloudBranchName: branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap,
  });
  return builder.buildAll();
}
