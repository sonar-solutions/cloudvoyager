import logger from '../../../../../shared/utils/logger.js';

// -------- Encode Extended Message Types --------

export function encodeSourceFilesText(messages) {
  logger.debug(`Preparing ${(messages.sourceFiles || []).length} source files as plain text...`);
  return (messages.sourceFiles || []).map(sf => ({
    componentRef: sf.componentRef,
    text: sf.lines.map(line => line.source).join('\n'),
  }));
}

export function encodeExternalIssues(encoder, messages) {
  const externalIssues = new Map();
  if (messages.externalIssuesByComponent?.size > 0) {
    logger.debug(`Encoding external issues for ${messages.externalIssuesByComponent.size} components...`);
    messages.externalIssuesByComponent.forEach((issues, ref) => {
      externalIssues.set(ref, Buffer.concat(issues.map(i => encoder.encodeExternalIssueDelimited(i))));
    });
  }
  return externalIssues;
}

export function encodeAdHocRulesBuffer(encoder, messages) {
  if (messages.adHocRules?.length > 0) {
    logger.debug(`Encoding ${messages.adHocRules.length} ad-hoc rules...`);
    return Buffer.concat(messages.adHocRules.map(r => encoder.encodeAdHocRuleDelimited(r)));
  }
  return Buffer.alloc(0);
}

export function encodeDuplications(encoder, messages) {
  const duplications = new Map();
  if (messages.duplicationsByComponent?.size > 0) {
    logger.debug(`Encoding duplications for ${messages.duplicationsByComponent.size} components...`);
    messages.duplicationsByComponent.forEach((dups, ref) => {
      duplications.set(ref, Buffer.concat(dups.map(d => encoder.encodeDuplicationDelimited(d))));
    });
  }
  return duplications;
}
