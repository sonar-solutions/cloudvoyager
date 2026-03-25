// -------- State Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class StateError extends CloudVoyagerError {
  constructor(message) { super(message, 500); }
}
