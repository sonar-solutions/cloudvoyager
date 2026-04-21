// -------- Create Shutdown Coordinator Factory --------
import logger from '../../logger.js';
import { runCleanupHandlers } from './run-cleanup-handlers.js';

export function createShutdownCoordinator() {
  let shuttingDown = false;
  let signalCount = 0;
  let bound = false;
  const handlers = [];

  async function onSignal(signal) {
    signalCount++;
    if (signalCount === 1) {
      shuttingDown = true;
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      const forceQuit = () => { logger.warn('\nForced shutdown.'); process.exit(1); };
      process.on('SIGINT', forceQuit);
      process.on('SIGTERM', forceQuit);
      logger.warn(`\n${signal} received. Graceful shutdown requested — finishing current operation...`);
      logger.warn('Press Ctrl+C again to force quit immediately.');
      await runCleanupHandlers(handlers);
      process.exit(0);
    }
  }

  return {
    bind() {
      if (bound) return;
      bound = true;
      process.on('SIGINT', onSignal);
      process.on('SIGTERM', onSignal);
    },
    register(handler) { handlers.push(handler); },
    isShuttingDown() { return shuttingDown; },
    shutdownCheck() { return () => shuttingDown; }
  };
}
