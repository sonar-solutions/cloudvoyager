import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Encode component messages.
export function encodeComponents(encoder, messages) {
  logger.debug(`Encoding ${(messages.components || []).length} components...`);
  const components = (messages.components || []).map(c => encoder.encodeComponent(c));
  return { components };
}
