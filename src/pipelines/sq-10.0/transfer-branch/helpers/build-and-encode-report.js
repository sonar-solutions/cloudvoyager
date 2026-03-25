// -------- Build And Encode Report --------

import logger from '../../../../shared/utils/logger.js';
import { ProtobufBuilder } from '../../protobuf/builder.js';
import { ProtobufEncoder } from '../../protobuf/encoder.js';

export async function buildAndEncodeReport({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap, label }) {
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
  return encoder.encodeAll(messages);
}
