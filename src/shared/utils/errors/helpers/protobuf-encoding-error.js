// -------- Protobuf Encoding Error --------
import { CloudVoyagerError } from './cloud-voyager-error.js';

export class ProtobufEncodingError extends CloudVoyagerError {
  constructor(message, data = null) {
    super(message, 500);
    this.data = data;
  }
}
