import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';
import { encodeComponents } from './encode-components.js';
import { encodeDelimitedMaps } from './encode-delimited-maps.js';
import { encodeSourceAndRules } from './encode-source-and-rules.js';

// -------- Main Logic --------

// Encode all protobuf messages from built messages object.
export function encodeAll(encoder, messages) {
  logger.info('Encoding all messages to protobuf...');
  if (!encoder.root) throw new ProtobufEncodingError('Schemas not loaded. Call loadSchemas() before encodeAll().');

  try {
    const encoded = {
      metadata: encoder.encodeMetadata(messages.metadata),
      ...encodeComponents(encoder, messages),
      ...encodeDelimitedMaps(encoder, messages),
      ...encodeSourceAndRules(encoder, messages),
    };
    logger.info('All messages encoded successfully');
    return encoded;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to encode messages: ${error.message}`);
  }
}
