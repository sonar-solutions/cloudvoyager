import logger from '../../utils/logger.js';
import { buildInheritanceChains } from '../../sonarqube/extractors/quality-profiles.js';

const MIGRATED_SUFFIX = ' (SonarQube Migrated)';

/**
 * Rename a built-in profile's backup XML so it restores as a custom profile.
 * Changes the <name> tag to append the migrated suffix.
 * Only modifies the FIRST <name> tag (the profile name, not rule names).
 */
function renameBuiltInBackupXml(backupXml, originalName) {
  const migratedName = originalName + MIGRATED_SUFFIX;
  // Replace only the first <name>...</name> occurrence (the profile name element)
  return backupXml.replace(
    `<name>${originalName}</name>`,
    `<name>${migratedName}</name>`
  );
}

/**
 * Migrate quality profiles from SonarQube to SonarCloud using backup/restore.
 * Handles both custom AND built-in profiles. Built-in profiles are restored
 * as custom profiles with a "(SonarQube Migrated)" suffix to preserve their
 * exact rule activations from SonarQube.
 *
 * @param {Array} extractedProfiles - Profiles extracted from SonarQube
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @returns {Promise<{profileMapping: Map<string, string>, builtInProfileMapping: Map<string, string>}>}
 *   profileMapping: SQ profile key -> SC profile name
 *   builtInProfileMapping: language -> migrated built-in profile name (for project assignment)
 */
export async function migrateQualityProfiles(extractedProfiles, client) {
  const profileMapping = new Map();
  const builtInProfileMapping = new Map(); // language -> migrated profile name

  const customProfiles = extractedProfiles.filter(p => !p.isBuiltIn);
  const builtInProfiles = extractedProfiles.filter(p => p.isBuiltIn);

  logger.info(`Migrating ${customProfiles.length} custom + ${builtInProfiles.length} built-in quality profiles`);

  const restored = new Set();

  // 1. Restore custom profiles (unchanged behavior)
  const chains = buildInheritanceChains(customProfiles);
  await restoreProfileChains(chains, restored, profileMapping, client);
  await restoreRemainingProfiles(customProfiles, restored, profileMapping, client);

  // 2. Restore built-in profiles as custom profiles with renamed XML
  for (const profile of builtInProfiles) {
    if (!profile.backupXml) {
      logger.warn(`No backup XML for built-in profile ${profile.name} (${profile.language}), skipping`);
      continue;
    }

    const migratedName = profile.name + MIGRATED_SUFFIX;
    const renamedXml = renameBuiltInBackupXml(profile.backupXml, profile.name);

    try {
      await client.restoreQualityProfile(renamedXml);
      profileMapping.set(profile.key, migratedName);
      builtInProfileMapping.set(profile.language, migratedName);
      restored.add(profile.key);
      logger.info(`Restored built-in profile as custom: ${migratedName} (${profile.language})`);
    } catch (error) {
      logger.warn(`Failed to restore built-in profile ${profile.name} (${profile.language}): ${error.message}`);
    }
  }

  // 3. Set defaults for custom profiles only (not migrated built-ins)
  await setDefaultProfiles(extractedProfiles, restored, client, builtInProfiles);

  // 4. Set permissions for custom profiles only
  await setProfilePermissions(customProfiles, restored, client);

  return { profileMapping, builtInProfileMapping };
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

async function setDefaultProfiles(extractedProfiles, restored, client, builtInProfiles) {
  const builtInKeys = new Set(builtInProfiles.map(p => p.key));

  for (const profile of extractedProfiles) {
    // Skip if not default, not restored, or if it's a migrated built-in
    // (migrated built-ins are assigned per-project, not set as org default)
    if (!profile.isDefault || !restored.has(profile.key) || builtInKeys.has(profile.key)) continue;

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
