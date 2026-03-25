// -------- Shutdown Coordinator --------
import { createShutdownCoordinator } from './helpers/create-shutdown-coordinator.js';
export { checkShutdown } from './helpers/check-shutdown.js';

export function createShutdownCoordinatorInstance() {
  return createShutdownCoordinator();
}

export class ShutdownCoordinator {
  constructor() { this._impl = createShutdownCoordinator(); }
  bind() { return this._impl.bind(); }
  register(handler) { return this._impl.register(handler); }
  isShuttingDown() { return this._impl.isShuttingDown(); }
  shutdownCheck() { return this._impl.shutdownCheck(); }
}
