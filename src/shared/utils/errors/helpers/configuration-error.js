// -------- Configuration Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class ConfigurationError extends CloudVoyagerError {
  constructor(message) { super(message, 400); }
}
