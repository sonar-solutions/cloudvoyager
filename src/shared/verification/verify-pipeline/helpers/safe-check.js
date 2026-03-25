// -------- Safe Check Wrapper --------

import logger from '../../../utils/logger.js';

/**
 * Wrap a checker function so it never throws — returns an error result instead.
 * @param {function} fn - Async checker function
 * @returns {Promise<object>} Check result or error object
 */
export async function safeCheck(fn) {
  try {
    return await fn();
  } catch (error) {
    logger.error(`Check failed: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}
