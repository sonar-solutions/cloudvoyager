import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';

// -------- Build All Protobuf Messages --------

export function buildAll(ctx) {
  logger.info('Building all protobuf messages...');
  try {
    const metadata = ctx.buildMetadata();
    const components = ctx.buildComponents();
    const externalResult = ctx.buildExternalIssues();
    const messages = {
      metadata, components,
      issuesByComponent: ctx.buildIssues(),
      measuresByComponent: ctx.buildMeasures(),
      sourceFiles: ctx.buildSourceFiles(),
      activeRules: ctx.buildActiveRules(),
      changesetsByComponent: ctx.buildChangesets(),
      duplicationsByComponent: ctx.buildDuplications(),
      externalIssuesByComponent: externalResult.externalIssuesByComponent,
      adHocRules: externalResult.adHocRules,
    };
    logger.info('Successfully built all protobuf messages');
    return messages;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to build protobuf messages: ${error.message}`);
  }
}
