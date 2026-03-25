import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';

// -------- Encode All Messages --------

/** Encode all protobuf messages into binary buffers. */
export function encodeAllMessages(inst, messages) {
  logger.info('Encoding all messages to protobuf...');
  if (!inst.root) throw new ProtobufEncodingError('Schemas not loaded. Call loadSchemas() before encodeAll().');

  try {
    const encoded = {
      metadata: inst.encodeMetadata(messages.metadata),
      components: (messages.components || []).map(c => inst.encodeComponent(c)),
      issues: encodeComponentMap(messages.issuesByComponent, i => inst.encodeIssueDelimited(i)),
      measures: encodeComponentMap(messages.measuresByComponent, m => inst.encodeMeasureDelimited(m)),
      sourceFilesText: (messages.sourceFiles || []).map(sf => ({ componentRef: sf.componentRef, text: sf.lines.map(l => l.source).join('\n') })),
      activeRules: Buffer.concat((messages.activeRules || []).map(r => inst.encodeActiveRuleDelimited(r))),
      changesets: encodeChangesets(messages.changesetsByComponent, c => inst.encodeChangeset(c)),
      externalIssues: encodeComponentMap(messages.externalIssuesByComponent, i => inst.encodeExternalIssueDelimited(i)),
      adHocRules: messages.adHocRules?.length > 0 ? Buffer.concat(messages.adHocRules.map(r => inst.encodeAdHocRuleDelimited(r))) : Buffer.alloc(0),
      duplications: encodeComponentMap(messages.duplicationsByComponent, d => inst.encodeDuplicationDelimited(d)),
    };

    logger.info('All messages encoded successfully');
    return encoded;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to encode messages: ${error.message}`);
  }
}

function encodeComponentMap(map, encodeFn) {
  const result = new Map();
  if (map && map.size > 0) map.forEach((items, ref) => result.set(ref, Buffer.concat(items.map(encodeFn))));
  return result;
}

function encodeChangesets(map, encodeFn) {
  const result = new Map();
  if (map && map.size > 0) map.forEach((cs, ref) => result.set(ref, encodeFn(cs)));
  return result;
}
