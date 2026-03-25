// -------- Graceful Shutdown Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class GracefulShutdownError extends CloudVoyagerError {
  constructor(message = 'Operation interrupted by shutdown signal') {
    super(message, 0);
  }
}
