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

  const restored = new Set();

  // Restore profiles in order: parents first (chains), then remaining
  const chains = buildInheritanceChains(customProfiles);
  await restoreProfileChains(chains, restored, profileMapping, client);
  await restoreRemainingProfiles(customProfiles, restored, profileMapping, client);

  // Set defaults and permissions
  await setDefaultProfiles(extractedProfiles, restored, client);
  await setProfilePermissions(customProfiles, restored, client);

  return profileMapping;
}

async function restoreOneProfile(profile, restored, profileMapping, client) {
  if (restored.has(profile.key) || !profile.backupXml) return;

  try {
    await client.restoreQualityProfile(profile.backupXml);
    profileMapping.set(profile.key, profile.name);
    restored.add(profile.key);
    logger.info(`Restored profile: ${profile.name} (${profile.language})`);
  } catch (error) {
    logger.warn(`Failed to restore profile ${profile.name}: ${error.message}`);
  }
}

async function restoreProfileChains(chains, restored, profileMapping, client) {
  for (const chain of chains) {
    for (const profile of chain) {
      await restoreOneProfile(profile, restored, profileMapping, client);
    }
  }
}

async function restoreRemainingProfiles(customProfiles, restored, profileMapping, client) {
  for (const profile of customProfiles) {
    await restoreOneProfile(profile, restored, profileMapping, client);
  }
}

async function setDefaultProfiles(extractedProfiles, restored, client) {
  for (const profile of extractedProfiles) {
    if (!profile.isDefault || !restored.has(profile.key)) continue;

    try {
      await client.setDefaultQualityProfile(profile.language, profile.name);
      logger.info(`Set default profile for ${profile.language}: ${profile.name}`);
    } catch (error) {
      logger.warn(`Failed to set default profile for ${profile.language}: ${error.message}`);
    }
  }
}

async function setProfilePermissions(customProfiles, restored, client) {
  for (const profile of customProfiles) {
    if (!restored.has(profile.key)) continue;

    await setProfileGroupPermissions(profile, client);
    await setProfileUserPermissions(profile, client);
  }
}

async function setProfileGroupPermissions(profile, client) {
  for (const group of (profile.permissions.groups || [])) {
    if (!group.selected) continue;

    try {
      await client.addQualityProfileGroupPermission(profile.name, profile.language, group.name);
    } catch (error) {
      logger.debug(`Failed to set profile permission for group ${group.name}: ${error.message}`);
    }
  }
}

async function setProfileUserPermissions(profile, client) {
  for (const user of (profile.permissions.users || [])) {
    if (!user.selected) continue;

    try {
      await client.addQualityProfileUserPermission(profile.name, profile.language, user.login);
    } catch (error) {
      logger.debug(`Failed to set profile permission for user ${user.login}: ${error.message}`);
    }
  }
}
