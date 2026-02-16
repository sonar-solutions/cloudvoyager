import logger from '../../utils/logger.js';

/**
 * Extract active rules from SonarQube quality profiles
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array} components - Source files to determine which languages are used
 * @returns {Promise<Array>}
 */
export async function extractActiveRules(client, components = []) {
  logger.info('Extracting active rules from quality profiles...');

  try {
    // Determine which languages are actually used in the project
    const usedLanguages = new Set();
    components.forEach(comp => {
      if (comp.language) {
        usedLanguages.add(comp.language.toLowerCase());
      }
    });

    // Add common related languages
    if (usedLanguages.has('js') || usedLanguages.has('javascript')) {
      usedLanguages.add('js');
      usedLanguages.add('javascript');
      usedLanguages.add('ts');  // TypeScript often analyzed together
      usedLanguages.add('web');  // HTML/Web files
    }

    logger.info(`Project uses languages: ${Array.from(usedLanguages).join(', ')}`);

    // Get all quality profiles for the project
    const profiles = await client.getQualityProfiles();
    logger.info(`Found ${profiles.length} quality profiles`);

    if (profiles.length === 0) {
      logger.warn('No quality profiles found for project');
      return [];
    }

    // Extract active rules from all profiles
    const allActiveRules = [];
    const ruleMap = new Map(); // To deduplicate rules across profiles

    for (const profile of profiles) {
      // Skip profiles for languages not used in the project
      if (usedLanguages.size > 0 && !usedLanguages.has(profile.language.toLowerCase())) {
        logger.debug(`Skipping profile for unused language: ${profile.language}`);
        continue;
      }

      logger.info(`Extracting rules from profile: ${profile.name} (${profile.language})`);

      // Get active rules for this profile
      const rules = await client.getActiveRules(profile.key);
      logger.info(`  Found ${rules.length} active rules`);

      // Process each rule
      for (const rule of rules) {
        const ruleId = `${rule.repo || rule.repository}:${rule.key}`;

        // Skip if we've already processed this rule
        if (ruleMap.has(ruleId)) {
          continue;
        }

        // Extract active rule data
        // Convert params array to map
        const paramsMap = {};
        if (rule.params && Array.isArray(rule.params)) {
          rule.params.forEach(param => {
            paramsMap[param.key] = param.defaultValue || param.value || '';
          });
        }

        const activeRule = {
          ruleRepository: rule.repo || rule.repository || 'unknown',
          ruleKey: rule.key,
          severity: mapSeverity(rule.severity),
          paramsByKey: paramsMap,
          createdAt: rule.createdAt ? new Date(rule.createdAt).getTime() : Date.now(),
          updatedAt: rule.updatedAt ? new Date(rule.updatedAt).getTime() : Date.now(),
          qProfileKey: profile.key,
          language: profile.language,  // ADD LANGUAGE FROM PROFILE
          impacts: extractImpacts(rule)
        };

        allActiveRules.push(activeRule);
        ruleMap.set(ruleId, activeRule);
      }
    }

    logger.info(`Extracted ${allActiveRules.length} unique active rules`);

    // Log breakdown by repository
    const repoCounts = {};
    allActiveRules.forEach(rule => {
      repoCounts[rule.ruleRepository] = (repoCounts[rule.ruleRepository] || 0) + 1;
    });

    logger.info('Active rules breakdown by repository:');
    Object.entries(repoCounts).forEach(([repo, count]) => {
      logger.info(`  ${repo}: ${count}`);
    });

    return allActiveRules;

  } catch (error) {
    logger.error(`Failed to extract active rules: ${error.message}`);
    throw error;
  }
}

/**
 * Map SonarQube severity to numeric value
 * @param {string} severity - SonarQube severity (INFO, MINOR, MAJOR, CRITICAL, BLOCKER)
 * @returns {number} Numeric severity
 */
function mapSeverity(severity) {
  const severityMap = {
    'INFO': 1,
    'MINOR': 2,
    'MAJOR': 3,
    'CRITICAL': 4,
    'BLOCKER': 5
  };

  return severityMap[severity?.toUpperCase()] || 3; // Default to MAJOR
}

/**
 * Extract impacts from rule data
 * @param {object} rule - Rule data from SonarQube
 * @returns {Array} Array of impact objects
 */
function extractImpacts(rule) {
  const impacts = [];

  // SonarQube 9.9+ has impacts array
  if (rule.impacts && Array.isArray(rule.impacts)) {
    return rule.impacts.map(impact => ({
      softwareQuality: mapSoftwareQuality(impact.softwareQuality),
      severity: mapImpactSeverity(impact.severity)
    }));
  }

  // Fallback: infer from rule type and severity
  if (rule.type) {
    const quality = inferQualityFromType(rule.type);
    if (quality > 0) {
      impacts.push({
        softwareQuality: quality,
        severity: mapImpactSeverityFromRuleSeverity(rule.severity)
      });
    }
  }

  return impacts;
}

/**
 * Map software quality string to numeric value
 * @param {string} quality - Software quality (MAINTAINABILITY, RELIABILITY, SECURITY)
 * @returns {number} Numeric quality
 */
function mapSoftwareQuality(quality) {
  const qualityMap = {
    'MAINTAINABILITY': 1,
    'RELIABILITY': 2,
    'SECURITY': 3
  };

  return qualityMap[quality?.toUpperCase()] || 1;
}

/**
 * Map impact severity string to numeric value
 * @param {string} severity - Impact severity (LOW, MEDIUM, HIGH, BLOCKER)
 * @returns {number} Numeric severity
 */
function mapImpactSeverity(severity) {
  const severityMap = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'BLOCKER': 4
  };

  return severityMap[severity?.toUpperCase()] || 2; // Default to MEDIUM
}

/**
 * Infer software quality from rule type
 * @param {string} type - Rule type (CODE_SMELL, BUG, VULNERABILITY, SECURITY_HOTSPOT)
 * @returns {number} Numeric quality
 */
function inferQualityFromType(type) {
  const typeMap = {
    'CODE_SMELL': 1, // MAINTAINABILITY
    'BUG': 2,        // RELIABILITY
    'VULNERABILITY': 3, // SECURITY
    'SECURITY_HOTSPOT': 3 // SECURITY
  };

  return typeMap[type?.toUpperCase()] || 0;
}

/**
 * Map rule severity to impact severity
 * @param {string} severity - Rule severity
 * @returns {number} Impact severity
 */
function mapImpactSeverityFromRuleSeverity(severity) {
  const severityMap = {
    'INFO': 1,    // LOW
    'MINOR': 1,   // LOW
    'MAJOR': 2,   // MEDIUM
    'CRITICAL': 3, // HIGH
    'BLOCKER': 4  // BLOCKER
  };

  return severityMap[severity?.toUpperCase()] || 2;
}
