import { createProtobufBuilder } from './helpers/create-protobuf-builder.js';

// -------- Main Logic --------

export { createProtobufBuilder };

// Thin class wrapper for backward compatibility.
export class ProtobufBuilder {
  constructor(extractedData, sonarCloudConfig, sonarCloudProfiles, options) {
    const instance = createProtobufBuilder(extractedData, sonarCloudConfig, sonarCloudProfiles, options);
    Object.assign(this, instance);
  }
}
