import { ProtobufEncoder } from '../../protobuf/encoder.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Encode Protobuf Report --------

export async function encodeReport(messages, label) {
  logger.info(`[${label}] Encoding to protobuf format...`);
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();
  return encoder.encodeAll(messages);
}
