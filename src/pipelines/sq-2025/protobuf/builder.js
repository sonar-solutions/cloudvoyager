// -------- Re-export (dual-export: factory + class wrapper) --------

export { createProtobufBuilder } from './builder/index.js';

import { createProtobufBuilder } from './builder/index.js';

/** Backward-compatible class wrapper around createProtobufBuilder. */
export class ProtobufBuilder {
  constructor(extractedData, sonarCloudConfig = {}, sonarCloudProfiles = [], options = {}) {
    const instance = createProtobufBuilder(extractedData, sonarCloudConfig, sonarCloudProfiles, options);
    Object.assign(this, instance);
  }
}
