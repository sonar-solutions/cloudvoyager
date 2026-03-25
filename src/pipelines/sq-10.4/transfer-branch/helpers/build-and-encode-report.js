import { ProtobufBuilder } from '../../protobuf/builder.js';
import { ProtobufEncoder } from '../../protobuf/encoder.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build and encode a protobuf scanner report for a branch.
export async function buildAndEncodeReport({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, referenceBranchName, label, sonarCloudRepos, ruleEnrichmentMap }) {
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
