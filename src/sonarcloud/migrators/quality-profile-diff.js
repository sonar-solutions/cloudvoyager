import logger from '../../utils/logger.js';

const MIGRATED_SUFFIX = ' (SonarQube Migrated)';

/**
 * Compare quality profiles between SonarQube and SonarCloud after migration.
 * For each language, compares the SonarQube profile's active rules against
 * the restored SonarCloud profile to identify missing or added rules.
 *
 * @param {Array} extractedProfiles - Profiles extracted from SonarQube (with activeRuleCount)
 * @param {import('../../sonarqube/api-client.js').SonarQubeClient} sqClient - SonarQube client
 * @param {import('../api-client.js').SonarCloudClient} scClient - SonarCloud client
 * @returns {Promise<object>} Diff report object
 */
export async function generateQualityProfileDiff(extractedProfiles, sqClient, scClient) {
  logger.info('Generating quality profile diff report...');

  // Get all SC profiles to find the restored ones
  const scProfiles = await scClient.searchQualityProfiles();
  const scProfilesByName = new Map(scProfiles.map(p => [`${p.language}:${p.name}`, p]));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      languagesCompared: 0,
      totalMissingRules: 0,
      totalAddedRules: 0
    },
    languages: {}
  };

  // Compare each SQ profile against its restored SC counterpart
  for (const sqProfile of extractedProfiles) {
    // Find the corresponding SC profile (either migrated built-in or restored custom)
    const scMigratedKey = `${sqProfile.language}:${sqProfile.name}${MIGRATED_SUFFIX}`;
    const scOriginalKey = `${sqProfile.language}:${sqProfile.name}`;
    const scProfile = scProfilesByName.get(scMigratedKey) || scProfilesByName.get(scOriginalKey);

    if (!scProfile) {
      logger.debug(`No SC profile found for ${sqProfile.name} (${sqProfile.language}), skipping diff`);
      continue;
    }

    try {
      const langDiff = await diffProfileRules(sqProfile, scProfile, sqClient, scClient);
      if (langDiff) {
        // Use language as key; if multiple profiles per language, append profile name
        const langKey = sqProfile.language;
        if (report.languages[langKey]) {
          // Multiple profiles for same language — use name-qualified key
          const qualifiedKey = `${langKey}:${sqProfile.name}`;
          report.languages[qualifiedKey] = langDiff;
        } else {
          report.languages[langKey] = langDiff;
        }
        report.summary.languagesCompared++;
        report.summary.totalMissingRules += langDiff.missingRules.length;
        report.summary.totalAddedRules += langDiff.addedRules.length;
      }
    } catch (error) {
      logger.warn(`Failed to diff profile ${sqProfile.name} (${sqProfile.language}): ${error.message}`);
    }
  }

  // Log summary
  logger.info(`Quality profile diff complete: ${report.summary.languagesCompared} languages compared`);
  if (report.summary.totalMissingRules > 0) {
    logger.warn(`${report.summary.totalMissingRules} rules in SonarQube but NOT in SonarCloud (may cause missing issues)`);
  }
  if (report.summary.totalAddedRules > 0) {
    logger.info(`${report.summary.totalAddedRules} rules in SonarCloud but NOT in SonarQube (may create new issues)`);
  }

  return report;
}

/**
 * Compare active rules between a SQ profile and its SC counterpart.
 */
async function diffProfileRules(sqProfile, scProfile, sqClient, scClient) {
  logger.debug(`Comparing rules: SQ "${sqProfile.name}" vs SC "${scProfile.name}" (${sqProfile.language})`);

  // Fetch active rules from both sides
  const [sqRules, scRules] = await Promise.all([
    sqClient.getActiveRules(sqProfile.key),
    scClient.getActiveRules(scProfile.key)
  ]);

  // Build rule maps by repository:key
  const sqRuleMap = new Map();
  for (const rule of sqRules) {
    const ruleKey = rule.key || `${rule.repo}:${rule.params?.[0]?.key || rule.name}`;
    sqRuleMap.set(ruleKey, rule);
  }

  const scRuleMap = new Map();
  for (const rule of scRules) {
    const ruleKey = rule.key || `${rule.repo}:${rule.name}`;
    scRuleMap.set(ruleKey, rule);
  }

  // Find missing rules (in SQ but not in SC)
  const missingRules = [];
  for (const [key, rule] of sqRuleMap) {
    if (!scRuleMap.has(key)) {
      missingRules.push(formatRule(key, rule));
    }
  }

  // Find added rules (in SC but not in SQ)
  const addedRules = [];
  for (const [key, rule] of scRuleMap) {
    if (!sqRuleMap.has(key)) {
      addedRules.push(formatRule(key, rule));
    }
  }

  if (missingRules.length > 0) {
    logger.warn(`  ${sqProfile.language}: ${missingRules.length} rules missing from SonarCloud: ${missingRules.map(r => r.key).join(', ')}`);
  }
  if (addedRules.length > 0) {
    logger.info(`  ${sqProfile.language}: ${addedRules.length} rules added in SonarCloud`);
  }
  if (missingRules.length === 0 && addedRules.length === 0) {
    logger.info(`  ${sqProfile.language}: profiles match perfectly (${sqRules.length} rules)`);
  }

  return {
    sonarqubeProfile: sqProfile.name,
    sonarcloudProfile: scProfile.name,
    sonarqubeRuleCount: sqRules.length,
    sonarcloudRuleCount: scRules.length,
    missingRules,
    addedRules
  };
}

/**
 * Format a rule for the diff report.
 */
function formatRule(key, rule) {
  return {
    key,
    name: rule.name || '',
    type: rule.type || '',
    severity: rule.severity || ''
  };
}
