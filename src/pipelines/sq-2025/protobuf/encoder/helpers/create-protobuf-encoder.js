import { encodeMessage, encodeMessageDelimited } from '../../encode-types.js';
import { loadSchemas } from './load-proto-schemas.js';
import { encodeAllMessages } from './encode-all-messages.js';

// -------- Create Protobuf Encoder --------

/** Factory function: create a ProtobufEncoder instance. */
export function createProtobufEncoder() {
  const inst = { root: null };

  inst.loadSchemas = async () => { inst.root = await loadSchemas(); };

  inst.encodeMetadata = (m) => encodeMessage(inst.root, 'Metadata', m);
  inst.encodeComponent = (c) => encodeMessage(inst.root, 'Component', c);
  inst.encodeIssueDelimited = (i) => encodeMessageDelimited(inst.root, 'Issue', i);
  inst.encodeMeasureDelimited = (m) => encodeMessageDelimited(inst.root, 'Measure', m);
  inst.encodeActiveRuleDelimited = (r) => encodeMessageDelimited(inst.root, 'ActiveRule', r);
  inst.encodeChangeset = (c) => encodeMessage(inst.root, 'Changesets', c);
  inst.encodeExternalIssueDelimited = (i) => encodeMessageDelimited(inst.root, 'ExternalIssue', i);
  inst.encodeAdHocRuleDelimited = (r) => encodeMessageDelimited(inst.root, 'AdHocRule', r);
  inst.encodeDuplicationDelimited = (d) => encodeMessageDelimited(inst.root, 'Duplication', d);
  inst.encodeAll = (messages) => encodeAllMessages(inst, messages);

  return inst;
}
