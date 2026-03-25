// -------- Authentication Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class AuthenticationError extends CloudVoyagerError {
  constructor(message, service = 'Unknown') {
    super(message, 401);
    this.service = service;
  }
}
