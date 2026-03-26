import { createProtobufEncoder } from './helpers/create-protobuf-encoder.js';

// -------- Main Logic --------

export { createProtobufEncoder };

// Thin class wrapper for backward compatibility.
// Uses prototype-aware assignment so sinon stubs work.
export class ProtobufEncoder {
  root = null;

  constructor() {
    const instance = createProtobufEncoder();
    for (const [key, value] of Object.entries(instance)) {
      if (typeof value === 'function' && typeof this[key]?.isSinonProxy !== 'undefined') continue;
      this[key] = value;
    }
  }

  // Prototype method placeholders for sinon stub compatibility.
  loadSchemas() {}
  encodeAll() {}
  encodeMetadata() {}
  encodeComponent() {}
  encodeIssueDelimited() {}
  encodeMeasureDelimited() {}
  encodeActiveRuleDelimited() {}
  encodeChangeset() {}
  encodeExternalIssueDelimited() {}
  encodeAdHocRuleDelimited() {}
  encodeDuplicationDelimited() {}
}
