import logger from '../../utils/logger.js';

/**
 * Extract all quality profiles with backup data and permissions
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array>} Quality profiles with full details
 */
export async function extractQualityProfiles(client) {
  const profiles = await client.getAllQualityProfiles();
  logger.info(`Found ${profiles.length} quality profiles`);

  const detailed = [];
  for (const profile of profiles) {
    // Get backup XML for restoration (using language + name, as required by the API)
    let backupXml = null;
    try {
      backupXml = await client.getQualityProfileBackup(profile.language, profile.name);
    } catch (error) {
      logger.warn(`Failed to backup profile ${profile.name} (${profile.language}): ${error.message}`);
    }

    // Get permissions (using language + name)
    const permissions = await client.getQualityProfilePermissions(profile.language, profile.name);

    detailed.push({
      key: profile.key,
      name: profile.name,
      language: profile.language,
      languageName: profile.languageName,
      isDefault: profile.isDefault || false,
      isBuiltIn: profile.isBuiltIn || false,
      parentKey: profile.parentKey || null,
      parentName: profile.parentName || null,
      activeRuleCount: profile.activeRuleCount || 0,
      activeDeprecatedRuleCount: profile.activeDeprecatedRuleCount || 0,
      rulesUpdatedAt: profile.rulesUpdatedAt,
      backupXml,
      permissions
    });
  }

  return detailed;
}

/**
 * Build parent profile inheritance chains
 * @param {Array} profiles - Extracted profiles
 * @returns {Array<Array>} Ordered chains (parent first, child last)
 */
export function buildInheritanceChains(profiles) {
  const byKey = new Map(profiles.map(p => [p.key, p]));
  const chains = [];
  const visited = new Set();

  for (const profile of profiles) {
    if (visited.has(profile.key)) continue;

    // Walk up to find the root
    const chain = [];
    let current = profile;
    while (current) {
      chain.unshift(current);
      visited.add(current.key);
      current = current.parentKey ? byKey.get(current.parentKey) : null;
    }

    if (chain.length > 1) {
      chains.push(chain);
    }
  }

  return chains;
}
