// -------- Run Cleanup Handlers --------
import logger from '../../logger.js';

export async function runCleanupHandlers(handlers) {
  for (const handler of handlers) {
    try { await handler(); }
    catch (error) { logger.error(`Cleanup handler error: ${error.message}`); }
  }
}
