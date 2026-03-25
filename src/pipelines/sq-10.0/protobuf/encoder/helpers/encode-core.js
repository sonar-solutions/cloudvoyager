import logger from '../../../../../shared/utils/logger.js';

// -------- Encode Core Message Types --------

export function encodeComponents(encoder, messages) {
  logger.debug(`Encoding ${(messages.components || []).length} components...`);
  return (messages.components || []).map(c => encoder.encodeComponent(c));
}

export function encodeIssues(encoder, issuesByComponent) {
  logger.debug(`Encoding issues for ${issuesByComponent.size} components...`);
  const issues = new Map();
  issuesByComponent.forEach((items, ref) => {
    issues.set(ref, Buffer.concat(items.map(i => encoder.encodeIssueDelimited(i))));
  });
  return issues;
}

export function encodeMeasures(encoder, measuresByComponent) {
  logger.debug(`Encoding measures for ${measuresByComponent.size} components...`);
  const measures = new Map();
  measuresByComponent.forEach((items, ref) => {
    measures.set(ref, Buffer.concat(items.map(m => encoder.encodeMeasureDelimited(m))));
  });
  return measures;
}

export function encodeActiveRulesBuffer(encoder, activeRules) {
  logger.debug(`Encoding ${(activeRules || []).length} active rules...`);
  return Buffer.concat((activeRules || []).map(r => encoder.encodeActiveRuleDelimited(r)));
}

export function encodeChangesets(encoder, changesetsByComponent) {
  logger.debug(`Encoding changesets for ${changesetsByComponent.size} components...`);
  const changesets = new Map();
  changesetsByComponent.forEach((cs, ref) => { changesets.set(ref, encoder.encodeChangeset(cs)); });
  return changesets;
}
