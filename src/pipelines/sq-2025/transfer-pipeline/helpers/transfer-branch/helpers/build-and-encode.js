import { ProtobufBuilder } from '../../../../protobuf/builder.js';
import { ProtobufEncoder } from '../../../../protobuf/encoder.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Build and Encode --------

/** Build protobuf messages and encode them. */
export function buildProtobufMessages(data, scConfig, profiles, branch, refBranch, repos, enrichMap, label) {
  logger.info(`[${label}] Building protobuf messages...`);
  const builder = new ProtobufBuilder(data, scConfig, profiles, {
    sonarCloudBranchName: branch, referenceBranchName: refBranch,
    sonarCloudRepos: repos, ruleEnrichmentMap: enrichMap,
  });
  return builder.buildAll();
}

export async function encodeMessages(messages, label) {
  logger.info(`[${label}] Encoding to protobuf format...`);
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  return encoder.encodeAll(messages);
}
