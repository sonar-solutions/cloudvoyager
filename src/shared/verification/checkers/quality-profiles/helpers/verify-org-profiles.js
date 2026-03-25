// -------- Verify Org Quality Profiles --------

import logger from '../../../../utils/logger.js';

/** Verify quality profiles between SonarQube and SonarCloud at the org level. */
export async function verifyQualityProfiles(sqClient, scClient) {
  const result = { status: 'pass', sqCount: 0, scCount: 0, missing: [], ruleCountMismatches: [], details: [] };

  const sqProfiles = await sqClient.getAllQualityProfiles();
  const scProfiles = await scClient.searchQualityProfiles();
  result.sqCount = sqProfiles.length;
  result.scCount = scProfiles.length;

  // Build SC lookup: language + name -> profile (also index by base name)
  const scMap = new Map();
  for (const p of scProfiles) {
    scMap.set(`${p.language}:${p.name}`, p);
    const baseName = p.name.replace(/ \(SonarQube Migrated\)$/, '');
    if (baseName !== p.name) scMap.set(`${p.language}:${baseName}`, p);
  }

  for (const sqP of sqProfiles) {
    const scP = scMap.get(`${sqP.language}:${sqP.name}`);
    if (!scP) { result.missing.push({ name: sqP.name, language: sqP.language }); continue; }

    const isBuiltIn = sqP.isBuiltIn || sqP.name.startsWith('Sonar way') || sqP.name === 'Sonar way';
    if (sqP.activeRuleCount !== scP.activeRuleCount && !isBuiltIn) {
      result.ruleCountMismatches.push({ name: sqP.name, language: sqP.language, sqRuleCount: sqP.activeRuleCount, scRuleCount: scP.activeRuleCount });
    }
    result.details.push({ name: sqP.name, language: sqP.language, sqRuleCount: sqP.activeRuleCount, scRuleCount: scP.activeRuleCount, status: (sqP.activeRuleCount === scP.activeRuleCount || isBuiltIn) ? 'pass' : 'fail' });
  }

  const scLanguages = new Set(scProfiles.map(p => p.language));
  const actionableMissing = result.missing.filter(m => scLanguages.has(m.language));
  if (actionableMissing.length > 0 || result.ruleCountMismatches.length > 0) result.status = 'fail';

  logger.info(`Quality profile verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}`);
  return result;
}
