// -------- SonarQube API Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class SonarQubeAPIError extends CloudVoyagerError {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message, statusCode);
    this.endpoint = endpoint;
  }
}
