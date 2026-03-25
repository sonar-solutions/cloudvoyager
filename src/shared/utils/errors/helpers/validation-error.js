// -------- Validation Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class ValidationError extends CloudVoyagerError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}
