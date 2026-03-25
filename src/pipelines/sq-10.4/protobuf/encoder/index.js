import { createProtobufEncoder } from './helpers/create-protobuf-encoder.js';

// -------- Main Logic --------

export { createProtobufEncoder };

// Thin class wrapper for backward compatibility.
export class ProtobufEncoder {
  root = null;
  constructor() { const instance = createProtobufEncoder(); Object.assign(this, instance); }
}
