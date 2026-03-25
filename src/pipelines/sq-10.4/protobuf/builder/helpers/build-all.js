import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';

// -------- Main Logic --------

// Build all protobuf messages for the scanner report.
export function buildAll(instance) {
  logger.info('Building all protobuf messages...');
  try {
    const metadata = instance.buildMetadata();
    const components = instance.buildComponents(); // must run first — populates validComponentKeys & componentRefMap
    const externalResult = instance.buildExternalIssues();
    const messages = {
      metadata, components,
      issuesByComponent: instance.buildIssues(),
      measuresByComponent: instance.buildMeasures(),
      sourceFiles: instance.buildSourceFiles(),
      activeRules: instance.buildActiveRules(),
      changesetsByComponent: instance.buildChangesets(),
      duplicationsByComponent: instance.buildDuplications(),
      externalIssuesByComponent: externalResult.externalIssuesByComponent,
      adHocRules: externalResult.adHocRules,
    };
    logger.info('Successfully built all protobuf messages');
    return messages;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to build protobuf messages: ${error.message}`);
  }
}
