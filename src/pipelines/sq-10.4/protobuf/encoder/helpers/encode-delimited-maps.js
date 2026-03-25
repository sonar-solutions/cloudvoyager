import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Encode issues, measures, external issues, duplications, and changesets maps.
export function encodeDelimitedMaps(encoder, messages) {
  const issues = encodeMap(messages.issuesByComponent, i => encoder.encodeIssueDelimited(i), 'issues');
  const measures = encodeMap(messages.measuresByComponent, m => encoder.encodeMeasureDelimited(m), 'measures');

  logger.debug(`Encoding changesets for ${messages.changesetsByComponent.size} components...`);
  const changesets = new Map();
  messages.changesetsByComponent.forEach((cs, ref) => { changesets.set(ref, encoder.encodeChangeset(cs)); });

  const externalIssues = encodeMap(messages.externalIssuesByComponent, i => encoder.encodeExternalIssueDelimited(i), 'external issues');
  const duplications = encodeMap(messages.duplicationsByComponent, d => encoder.encodeDuplicationDelimited(d), 'duplications');

  return { issues, measures, changesets, externalIssues, duplications };
}

function encodeMap(map, encodeFn, label) {
  if (!map || map.size === 0) return new Map();
  logger.debug(`Encoding ${label} for ${map.size} components...`);
  const result = new Map();
  map.forEach((items, ref) => { result.set(ref, Buffer.concat(items.map(encodeFn))); });
  return result;
}
