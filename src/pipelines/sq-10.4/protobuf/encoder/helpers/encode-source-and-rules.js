import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Encode source files as text, active rules, and ad-hoc rules.
export function encodeSourceAndRules(encoder, messages) {
  logger.debug(`Preparing ${(messages.sourceFiles || []).length} source files as plain text...`);
  const sourceFilesText = (messages.sourceFiles || []).map(sf => ({
    componentRef: sf.componentRef,
    text: sf.lines.map(l => l.source).join('\n')
  }));

  logger.debug(`Encoding ${(messages.activeRules || []).length} active rules...`);
  const activeRules = Buffer.concat((messages.activeRules || []).map(r => encoder.encodeActiveRuleDelimited(r)));

  let adHocRules = Buffer.alloc(0);
  if (messages.adHocRules?.length > 0) {
    logger.debug(`Encoding ${messages.adHocRules.length} ad-hoc rules...`);
    adHocRules = Buffer.concat(messages.adHocRules.map(r => encoder.encodeAdHocRuleDelimited(r)));
  }

  return { sourceFilesText, activeRules, adHocRules };
}
