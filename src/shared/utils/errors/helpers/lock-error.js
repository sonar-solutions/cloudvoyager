// -------- Lock Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class LockError extends CloudVoyagerError {
  constructor(message) { super(message, 423); }
}
