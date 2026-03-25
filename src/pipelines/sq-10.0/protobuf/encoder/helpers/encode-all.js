import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';
import * as core from './encode-core.js';
import * as ext from './encode-extended.js';

// -------- Encode All Messages --------

export function encodeAll(encoder, messages) {
  logger.info('Encoding all messages to protobuf...');
  if (!encoder.root) {
    throw new ProtobufEncodingError('Schemas not loaded. Call loadSchemas() before encodeAll().');
  }
  try {
    const encoded = {
      metadata: encoder.encodeMetadata(messages.metadata),
      components: core.encodeComponents(encoder, messages),
      issues: core.encodeIssues(encoder, messages.issuesByComponent),
      measures: core.encodeMeasures(encoder, messages.measuresByComponent),
      sourceFilesText: ext.encodeSourceFilesText(messages),
      activeRules: core.encodeActiveRulesBuffer(encoder, messages.activeRules),
      changesets: core.encodeChangesets(encoder, messages.changesetsByComponent),
      externalIssues: ext.encodeExternalIssues(encoder, messages),
      adHocRules: ext.encodeAdHocRulesBuffer(encoder, messages),
      duplications: ext.encodeDuplications(encoder, messages),
    };
    logger.info('All messages encoded successfully');
    return encoded;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to encode messages: ${error.message}`);
  }
}
