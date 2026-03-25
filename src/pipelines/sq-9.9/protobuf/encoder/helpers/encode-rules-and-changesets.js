import logger from '../../../../../shared/utils/logger.js';

// -------- Encode Active Rules, Changesets, External Issues, Ad-Hoc Rules, Duplications --------

export function encodeRulesAndChangesets(encoder, messages) {
  logger.debug(`Encoding ${(messages.activeRules || []).length} active rules...`);
  const activeRules = Buffer.concat((messages.activeRules || []).map(r => encoder.encodeActiveRuleDelimited(r)));

  const changesets = new Map();
  logger.debug(`Encoding changesets for ${messages.changesetsByComponent.size} components...`);
  messages.changesetsByComponent.forEach((cs, ref) => changesets.set(ref, encoder.encodeChangeset(cs)));

  const externalIssues = new Map();
  if (messages.externalIssuesByComponent?.size > 0) {
    logger.debug(`Encoding external issues for ${messages.externalIssuesByComponent.size} components...`);
    messages.externalIssuesByComponent.forEach((iss, ref) => {
      externalIssues.set(ref, Buffer.concat(iss.map(i => encoder.encodeExternalIssueDelimited(i))));
    });
  }

  let adHocRules = Buffer.alloc(0);
  if (messages.adHocRules?.length > 0) {
    logger.debug(`Encoding ${messages.adHocRules.length} ad-hoc rules...`);
    adHocRules = Buffer.concat(messages.adHocRules.map(r => encoder.encodeAdHocRuleDelimited(r)));
  }

  const duplications = new Map();
  if (messages.duplicationsByComponent?.size > 0) {
    logger.debug(`Encoding duplications for ${messages.duplicationsByComponent.size} components...`);
    messages.duplicationsByComponent.forEach((dups, ref) => {
      duplications.set(ref, Buffer.concat(dups.map(d => encoder.encodeDuplicationDelimited(d))));
    });
  }

  return { activeRules, changesets, externalIssues, adHocRules, duplications };
}
