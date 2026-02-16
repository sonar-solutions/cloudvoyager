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
    const usedLanguages = detectUsedLanguages(components);
    logger.info(`Project uses languages: ${Array.from(usedLanguages).join(', ')}`);

    const profiles = await client.getQualityProfiles();
    logger.info(`Found ${profiles.length} quality profiles`);

    if (profiles.length === 0) {
      logger.warn('No quality profiles found for project');
      return [];
    }

    const allActiveRules = await extractRulesFromProfiles(client, profiles, usedLanguages);

    logger.info(`Extracted ${allActiveRules.length} unique active rules`);
    logRuleBreakdown(allActiveRules);

    return allActiveRules;

  } catch (error) {
    logger.error(`Failed to extract active rules: ${error.message}`);
    throw error;
  }
}

function detectUsedLanguages(components) {
  const usedLanguages = new Set();
  components.forEach(comp => {
    if (comp.language) {
      usedLanguages.add(comp.language.toLowerCase());
    }
  });

  if (usedLanguages.has('js') || usedLanguages.has('javascript')) {
    usedLanguages.add('js');
    usedLanguages.add('javascript');
    usedLanguages.add('ts');
    usedLanguages.add('web');
  }

  return usedLanguages;
}

async function extractRulesFromProfiles(client, profiles, usedLanguages) {
  const allActiveRules = [];
  const ruleMap = new Map();

  for (const profile of profiles) {
    if (usedLanguages.size > 0 && !usedLanguages.has(profile.language.toLowerCase())) {
      logger.debug(`Skipping profile for unused language: ${profile.language}`);
      continue;
    }

    logger.info(`Extracting rules from profile: ${profile.name} (${profile.language})`);
    const rules = await client.getActiveRules(profile.key);
    logger.info(`  Found ${rules.length} active rules`);

    for (const rule of rules) {
      const ruleId = `${rule.repo || rule.repository}:${rule.key}`;
      if (ruleMap.has(ruleId)) {
        continue;
      }

      const activeRule = buildActiveRule(rule, profile);
      allActiveRules.push(activeRule);
      ruleMap.set(ruleId, activeRule);
    }
  }

  return allActiveRules;
}

function buildActiveRule(rule, profile) {
  const paramsMap = {};
  if (rule.params && Array.isArray(rule.params)) {
    rule.params.forEach(param => {
      paramsMap[param.key] = param.defaultValue || param.value || '';
    });
  }

  return {
    ruleRepository: rule.repo || rule.repository || 'unknown',
    ruleKey: rule.key,
    severity: mapSeverity(rule.severity),
    paramsByKey: paramsMap,
    createdAt: rule.createdAt ? new Date(rule.createdAt).getTime() : Date.now(),
    updatedAt: rule.updatedAt ? new Date(rule.updatedAt).getTime() : Date.now(),
    qProfileKey: profile.key,
    language: profile.language,
    impacts: extractImpacts(rule)
  };
}

function logRuleBreakdown(allActiveRules) {
  const repoCounts = {};
  allActiveRules.forEach(rule => {
    repoCounts[rule.ruleRepository] = (repoCounts[rule.ruleRepository] || 0) + 1;
  });

  logger.info('Active rules breakdown by repository:');
  Object.entries(repoCounts).forEach(([repo, count]) => {
    logger.info(`  ${repo}: ${count}`);
  });
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
