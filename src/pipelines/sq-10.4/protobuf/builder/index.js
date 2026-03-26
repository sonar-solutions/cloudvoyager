import { createProtobufBuilder } from './helpers/create-protobuf-builder.js';

// -------- Main Logic --------

export { createProtobufBuilder };

// Thin class wrapper for backward compatibility.
// Uses prototype-aware assignment so sinon stubs work.
export class ProtobufBuilder {
  constructor(extractedData, sonarCloudConfig, sonarCloudProfiles, options) {
    const instance = createProtobufBuilder(extractedData, sonarCloudConfig, sonarCloudProfiles, options);
    for (const [key, value] of Object.entries(instance)) {
      if (typeof value === 'function' && typeof this[key]?.isSinonProxy !== 'undefined') continue;
      this[key] = value;
    }
  }

  // Prototype method placeholders for sinon stub compatibility.
  buildAll() {}
  buildMetadata() {}
  buildComponents() {}
  buildIssues() {}
  buildExternalIssues() {}
  buildMeasures() {}
  buildDuplications() {}
  buildMeasure() {}
  parseMeasureValue() {}
  buildSourceFiles() {}
  buildActiveRules() {}
  buildQProfiles() {}
  buildChangesets() {}
  buildFileCountsByType() {}
}
