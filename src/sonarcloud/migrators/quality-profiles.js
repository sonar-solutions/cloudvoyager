import logger from '../../utils/logger.js';
import { buildInheritanceChains } from '../../sonarqube/extractors/quality-profiles.js';

/**
 * Migrate quality profiles from SonarQube to SonarCloud using backup/restore
 * @param {Array} extractedProfiles - Profiles extracted from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @returns {Promise<Map<string, string>>} Mapping of SQ profile key -> SC profile name
 */
export async function migrateQualityProfiles(extractedProfiles, client) {
  const profileMapping = new Map();

  // Skip built-in profiles
  const customProfiles = extractedProfiles.filter(p => !p.isBuiltIn);
  logger.info(`Migrating ${customProfiles.length} custom quality profiles (skipping ${extractedProfiles.length - customProfiles.length} built-in)`);

  // Restore profiles in order: parents first, then children
  const chains = buildInheritanceChains(customProfiles);
  const restored = new Set();

  // First restore profiles that are part of inheritance chains (in order)
  for (const chain of chains) {
    for (const profile of chain) {
      if (restored.has(profile.key) || !profile.backupXml) continue;

      try {
        await client.restoreQualityProfile(profile.backupXml);
        profileMapping.set(profile.key, profile.name);
        restored.add(profile.key);
        logger.info(`Restored profile: ${profile.name} (${profile.language})`);
      } catch (error) {
        logger.warn(`Failed to restore profile ${profile.name}: ${error.message}`);
      }
    }
  }

  // Then restore any remaining profiles not in chains
  for (const profile of customProfiles) {
    if (restored.has(profile.key) || !profile.backupXml) continue;

    try {
      await client.restoreQualityProfile(profile.backupXml);
      profileMapping.set(profile.key, profile.name);
      restored.add(profile.key);
      logger.info(`Restored profile: ${profile.name} (${profile.language})`);
    } catch (error) {
      logger.warn(`Failed to restore profile ${profile.name}: ${error.message}`);
    }
  }

  // Set defaults
  for (const profile of extractedProfiles) {
    if (profile.isDefault && restored.has(profile.key)) {
      try {
        await client.setDefaultQualityProfile(profile.language, profile.name);
        logger.info(`Set default profile for ${profile.language}: ${profile.name}`);
      } catch (error) {
        logger.warn(`Failed to set default profile for ${profile.language}: ${error.message}`);
      }
    }
  }

  // Set permissions
  for (const profile of customProfiles) {
    if (!restored.has(profile.key)) continue;

    for (const group of (profile.permissions.groups || [])) {
      if (group.selected) {
        try {
          await client.addQualityProfileGroupPermission(profile.name, profile.language, group.name);
        } catch (error) {
          logger.debug(`Failed to set profile permission for group ${group.name}: ${error.message}`);
        }
      }
    }

    for (const user of (profile.permissions.users || [])) {
      if (user.selected) {
        try {
          await client.addQualityProfileUserPermission(profile.name, profile.language, user.login);
        } catch (error) {
          logger.debug(`Failed to set profile permission for user ${user.login}: ${error.message}`);
        }
      }
    }
  }

  return profileMapping;
}
