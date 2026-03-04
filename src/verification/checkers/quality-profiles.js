import logger from '../../utils/logger.js';

/**
 * Verify quality profiles between SonarQube and SonarCloud at the org level.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @returns {Promise<object>} Check result
 */
export async function verifyQualityProfiles(sqClient, scClient) {
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    missing: [],
    ruleCountMismatches: [],
    details: []
  };

  const sqProfiles = await sqClient.getAllQualityProfiles();
  result.sqCount = sqProfiles.length;

  const scProfiles = await scClient.searchQualityProfiles();
  result.scCount = scProfiles.length;

  // Build SC lookup: language + name -> profile
  const scProfileMap = new Map();
  for (const p of scProfiles) {
    scProfileMap.set(`${p.language}:${p.name}`, p);
  }

  for (const sqProfile of sqProfiles) {
    const lookupKey = `${sqProfile.language}:${sqProfile.name}`;
    const scProfile = scProfileMap.get(lookupKey);

    if (!scProfile) {
      result.missing.push({ name: sqProfile.name, language: sqProfile.language });
      continue;
    }

    // Compare active rule counts
    if (sqProfile.activeRuleCount !== scProfile.activeRuleCount) {
      result.ruleCountMismatches.push({
        name: sqProfile.name,
        language: sqProfile.language,
        sqRuleCount: sqProfile.activeRuleCount,
        scRuleCount: scProfile.activeRuleCount
      });
    }

    result.details.push({
      name: sqProfile.name,
      language: sqProfile.language,
      sqRuleCount: sqProfile.activeRuleCount,
      scRuleCount: scProfile.activeRuleCount,
      status: sqProfile.activeRuleCount === scProfile.activeRuleCount ? 'pass' : 'fail'
    });
  }

  if (result.missing.length > 0 || result.ruleCountMismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Quality profile verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}, rule count mismatches=${result.ruleCountMismatches.length}`);
  return result;
}

/**
 * Verify quality profile assignment for a project.
 */
export async function verifyProjectQualityProfiles(sqClient, scClient, scProjectKey) {
  const result = {
    status: 'pass',
    mismatches: [],
    details: []
  };

  let sqProfiles, scProfiles;
  try {
    sqProfiles = await sqClient.getQualityProfiles();
  } catch (error) {
    logger.debug(`Failed to get SQ project profiles: ${error.message}`);
    sqProfiles = [];
  }

  try {
    scProfiles = await scClient.getQualityProfiles();
  } catch (error) {
    logger.debug(`Failed to get SC project profiles: ${error.message}`);
    scProfiles = [];
  }

  const scProfileMap = new Map(scProfiles.map(p => [p.language, p.name]));

  for (const sqProfile of sqProfiles) {
    const scProfileName = scProfileMap.get(sqProfile.language);
    const match = scProfileName === sqProfile.name;
    result.details.push({
      language: sqProfile.language,
      sqProfile: sqProfile.name,
      scProfile: scProfileName || null,
      status: match ? 'pass' : 'fail'
    });
    if (!match) {
      result.mismatches.push({
        language: sqProfile.language,
        sqProfile: sqProfile.name,
        scProfile: scProfileName || null
      });
    }
  }

  if (result.mismatches.length > 0) {
    result.status = 'fail';
  }

  return result;
}
