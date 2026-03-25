// -------- Re-export (dual-export: factory + class wrapper) --------

export { createProtobufEncoder } from './encoder/index.js';

import { createProtobufEncoder } from './encoder/index.js';

/** Backward-compatible class wrapper around createProtobufEncoder. */
export class ProtobufEncoder {
  root = null;
  constructor() {
    const instance = createProtobufEncoder();
    Object.assign(this, instance);
  }
}
