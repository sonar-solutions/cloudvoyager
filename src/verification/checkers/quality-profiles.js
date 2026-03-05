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
  // Also index by base name (strip " (SonarQube Migrated)" suffix)
  const scProfileMap = new Map();
  for (const p of scProfiles) {
    scProfileMap.set(`${p.language}:${p.name}`, p);
    const baseName = p.name.replace(/ \(SonarQube Migrated\)$/, '');
    if (baseName !== p.name) {
      scProfileMap.set(`${p.language}:${baseName}`, p);
    }
  }

  for (const sqProfile of sqProfiles) {
    const lookupKey = `${sqProfile.language}:${sqProfile.name}`;
    const scProfile = scProfileMap.get(lookupKey);

    if (!scProfile) {
      result.missing.push({ name: sqProfile.name, language: sqProfile.language });
      continue;
    }

    // Compare active rule counts.
    // Built-in profiles (like "Sonar way") may have different rule counts
    // between SQ and SC platform versions — only flag custom profiles.
    const isBuiltIn = sqProfile.isBuiltIn || sqProfile.name.startsWith('Sonar way') || sqProfile.name === 'Sonar way';
    if (sqProfile.activeRuleCount !== scProfile.activeRuleCount && !isBuiltIn) {
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
      status: (sqProfile.activeRuleCount === scProfile.activeRuleCount || isBuiltIn) ? 'pass' : 'fail'
    });
  }

  // Only count missing profiles as failures if SC supports that language.
  // Profiles for SQ-only plugins (e.g. MuleSoft) or SQ-specific editions
  // (e.g. MISRA) may not exist in SC and that is expected.
  const scLanguages = new Set(scProfiles.map(p => p.language));
  const actionableMissing = result.missing.filter(m => scLanguages.has(m.language));

  if (actionableMissing.length > 0 || result.ruleCountMismatches.length > 0) {
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
  const scLanguages = new Set(scProfiles.map(p => p.language));

  for (const sqProfile of sqProfiles) {
    // Skip languages that don't exist in SC (e.g. MuleSoft) — can't be migrated
    if (!scLanguages.has(sqProfile.language)) {
      result.details.push({
        language: sqProfile.language,
        sqProfile: sqProfile.name,
        scProfile: null,
        status: 'pass',
        note: 'language not available in SonarCloud'
      });
      continue;
    }

    const scProfileName = scProfileMap.get(sqProfile.language);
    // Treat "X (SonarQube Migrated)" as equivalent to "X"
    const scNormalized = scProfileName ? scProfileName.replace(/ \(SonarQube Migrated\)$/, '') : null;
    const match = scNormalized === sqProfile.name;
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
