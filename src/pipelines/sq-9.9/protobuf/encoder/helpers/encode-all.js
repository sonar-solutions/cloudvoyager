import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';
import { encodeCoreMessages } from './encode-core-messages.js';
import { encodeRulesAndChangesets } from './encode-rules-and-changesets.js';

// -------- Encode All Protobuf Messages --------

export function encodeAll(encoder, messages) {
  logger.info('Encoding all messages to protobuf...');
  if (!encoder.root) throw new ProtobufEncodingError('Schemas not loaded. Call loadSchemas() before encodeAll().');

  try {
    const metadata = encoder.encodeMetadata(messages.metadata);
    const core = encodeCoreMessages(encoder, messages);
    const extended = encodeRulesAndChangesets(encoder, messages);

    logger.info('All messages encoded successfully');
    return { metadata, ...core, ...extended };
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to encode messages: ${error.message}`);
  }
}
