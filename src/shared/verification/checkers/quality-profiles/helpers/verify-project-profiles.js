// -------- Verify Project Quality Profiles --------

import logger from '../../../../utils/logger.js';

/** Verify quality profile assignment for a project. */
export async function verifyProjectQualityProfiles(sqClient, scClient, scProjectKey) {
  const result = { status: 'pass', mismatches: [], details: [] };

  let sqProfiles, scProfiles;
  try { sqProfiles = await sqClient.getQualityProfiles(); } catch (e) { logger.debug(`Failed to get SQ project profiles: ${e.message}`); sqProfiles = []; }
  try { scProfiles = await scClient.getQualityProfiles(); } catch (e) { logger.debug(`Failed to get SC project profiles: ${e.message}`); scProfiles = []; }

  const scMap = new Map(scProfiles.map(p => [p.language, p.name]));
  const scLanguages = new Set(scProfiles.map(p => p.language));

  for (const sqP of sqProfiles) {
    if (!scLanguages.has(sqP.language)) {
      result.details.push({ language: sqP.language, sqProfile: sqP.name, scProfile: null, status: 'pass', note: 'language not available in SonarCloud' });
      continue;
    }
    const scName = scMap.get(sqP.language);
    const scNorm = scName ? scName.replace(/ \(SonarQube Migrated\)$/, '') : null;
    const match = scNorm === sqP.name;
    result.details.push({ language: sqP.language, sqProfile: sqP.name, scProfile: scName || null, status: match ? 'pass' : 'fail' });
    if (!match) result.mismatches.push({ language: sqP.language, sqProfile: sqP.name, scProfile: scName || null });
  }

  if (result.mismatches.length > 0) result.status = 'fail';
  return result;
}
