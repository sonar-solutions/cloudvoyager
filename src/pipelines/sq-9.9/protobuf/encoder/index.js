import { encodeMessage, encodeMessageDelimited } from '../encode-types.js';
import { loadProtoSchemas } from './helpers/load-proto-schemas.js';
import { encodeAll } from './helpers/encode-all.js';

// -------- ProtobufEncoder — Dual Export (Factory + Class) --------

export function createProtobufEncoder() {
  const encoder = {
    root: null,
    async loadSchemas() { encoder.root = await loadProtoSchemas(); },
    encodeMetadata(m) { return encodeMessage(encoder.root, 'Metadata', m); },
    encodeComponent(c) { return encodeMessage(encoder.root, 'Component', c); },
    encodeIssueDelimited(i) { return encodeMessageDelimited(encoder.root, 'Issue', i); },
    encodeMeasureDelimited(m) { return encodeMessageDelimited(encoder.root, 'Measure', m); },
    encodeActiveRuleDelimited(r) { return encodeMessageDelimited(encoder.root, 'ActiveRule', r); },
    encodeChangeset(c) { return encodeMessage(encoder.root, 'Changesets', c); },
    encodeExternalIssueDelimited(i) { return encodeMessageDelimited(encoder.root, 'ExternalIssue', i); },
    encodeAdHocRuleDelimited(r) { return encodeMessageDelimited(encoder.root, 'AdHocRule', r); },
    encodeDuplicationDelimited(d) { return encodeMessageDelimited(encoder.root, 'Duplication', d); },
    encodeAll(messages) { return encodeAll(encoder, messages); },
  };
  return encoder;
}

export class ProtobufEncoder {
  constructor() { Object.assign(this, createProtobufEncoder()); }
}
