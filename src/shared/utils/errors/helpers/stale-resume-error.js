// -------- Stale Resume Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class StaleResumeError extends CloudVoyagerError {
  constructor(message) { super(message, 409); }
}
