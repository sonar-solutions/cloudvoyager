import protobuf from 'protobufjs';
import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';
import { encodeMessage, encodeMessageDelimited } from '../../encode-types.js';
import { loadProtoSchemas } from './load-proto-schemas.js';
import { encodeAll } from './encode-all.js';

// -------- Main Logic --------

// Factory function to create a ProtobufEncoder instance.
export function createProtobufEncoder() {
  const instance = { root: null };

  instance.loadSchemas = async () => {
    logger.info('Loading protobuf schemas...');
    try {
      const [constantsText, scannerReportText] = await loadProtoSchemas();
      const root = new protobuf.Root();
      protobuf.parse(constantsText, root);
      protobuf.parse(scannerReportText.replace(/^import\s+"constants\.proto";\s*$/m, ''), root);
      instance.root = root;
      logger.info('Protobuf schemas loaded successfully');
    } catch (error) {
      throw new ProtobufEncodingError(`Failed to load protobuf schemas: ${error.message}`);
    }
  };

  instance.encodeMetadata = (m) => encodeMessage(instance.root, 'Metadata', m);
  instance.encodeComponent = (c) => encodeMessage(instance.root, 'Component', c);
  instance.encodeIssueDelimited = (i) => encodeMessageDelimited(instance.root, 'Issue', i);
  instance.encodeMeasureDelimited = (m) => encodeMessageDelimited(instance.root, 'Measure', m);
  instance.encodeActiveRuleDelimited = (r) => encodeMessageDelimited(instance.root, 'ActiveRule', r);
  instance.encodeChangeset = (c) => encodeMessage(instance.root, 'Changesets', c);
  instance.encodeExternalIssueDelimited = (i) => encodeMessageDelimited(instance.root, 'ExternalIssue', i);
  instance.encodeAdHocRuleDelimited = (r) => encodeMessageDelimited(instance.root, 'AdHocRule', r);
  instance.encodeDuplicationDelimited = (d) => encodeMessageDelimited(instance.root, 'Duplication', d);
  instance.encodeAll = (messages) => encodeAll(instance, messages);

  return instance;
}
