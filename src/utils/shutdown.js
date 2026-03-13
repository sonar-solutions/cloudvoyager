import logger from './logger.js';
import { GracefulShutdownError } from './errors.js';

/**
 * Coordinates graceful shutdown on SIGINT/SIGTERM.
 *
 * First signal: sets shuttingDown flag, runs cleanup handlers, exits 0.
 * Second signal: forces immediate exit.
 */
export class ShutdownCoordinator {
  constructor() {
    this._shuttingDown = false;
    this._handlers = [];
    this._signalCount = 0;
    this._bound = false;
  }

  /**
   * Start listening for signals.
   */
  bind() {
    if (this._bound) return;
    this._bound = true;

    const onSignal = (signal) => this._onSignal(signal);
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
  }

  /**
   * Register a cleanup handler (async function).
   * Handlers run in registration order on graceful shutdown.
   * @param {Function} handler - async cleanup function
   */
  register(handler) {
    this._handlers.push(handler);
  }

  /**
   * Check if shutdown has been requested.
   * @returns {boolean}
   */
  isShuttingDown() {
    return this._shuttingDown;
  }

  /**
   * Returns a callback suitable for passing into pipeline functions.
   * @returns {Function}
   */
  shutdownCheck() {
    return () => this._shuttingDown;
  }

  /**
   * Handle incoming signal.
   * @param {string} signal
   */
  async _onSignal(signal) {
    this._signalCount++;

    if (this._signalCount === 1) {
      this._shuttingDown = true;
      logger.warn(`\n${signal} received. Graceful shutdown requested — finishing current operation...`);
      logger.warn('Press Ctrl+C again to force quit immediately.');

      // Run cleanup handlers
      for (const handler of this._handlers) {
        try {
          await handler();
        } catch (error) {
          logger.error(`Cleanup handler error: ${error.message}`);
        }
      }

      process.exit(0);
    } else {
      logger.warn('\nForced shutdown.');
      process.exit(1);
    }
  }
}

/**
 * Throws GracefulShutdownError if shutdown has been requested.
 * Use between phases to bail out cleanly.
 * @param {Function} shutdownCheck - () => boolean
 */
export function checkShutdown(shutdownCheck) {
  if (shutdownCheck && shutdownCheck()) {
    throw new GracefulShutdownError();
  }
}
