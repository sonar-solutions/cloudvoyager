import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';

// -------- Build All Messages --------

/** Orchestrate building all protobuf messages. */
export function buildAll(inst) {
  logger.info('Building all protobuf messages...');
  try {
    const metadata = inst.buildMetadata();
    const components = inst.buildComponents();
    const externalResult = inst.buildExternalIssues();

    const messages = {
      metadata, components,
      issuesByComponent: inst.buildIssues(),
      measuresByComponent: inst.buildMeasures(),
      sourceFiles: inst.buildSourceFiles(),
      activeRules: inst.buildActiveRules(),
      changesetsByComponent: inst.buildChangesets(),
      duplicationsByComponent: inst.buildDuplications(),
      externalIssuesByComponent: externalResult.externalIssuesByComponent,
      adHocRules: externalResult.adHocRules,
    };

    logger.info('Successfully built all protobuf messages');
    return messages;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to build protobuf messages: ${error.message}`);
  }
}
