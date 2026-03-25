import logger from '../../../../../../shared/utils/logger.js';

// -------- Set Profile Permissions --------

/** Set default profiles for restored custom profiles (not migrated built-ins). */
export async function setDefaultProfiles(extractedProfiles, restored, client, builtInProfiles) {
  const builtInKeys = new Set(builtInProfiles.map(p => p.key));
  for (const profile of extractedProfiles) {
    if (!profile.isDefault || !restored.has(profile.key) || builtInKeys.has(profile.key)) continue;
    try {
      await client.setDefaultQualityProfile(profile.language, profile.name);
      logger.info(`Set default profile for ${profile.language}: ${profile.name}`);
    } catch (error) {
      logger.warn(`Failed to set default profile for ${profile.language}: ${error.message}`);
    }
  }
}

/** Set group and user permissions for restored custom profiles. */
export async function setProfilePermissions(customProfiles, restored, client) {
  for (const profile of customProfiles) {
    if (!restored.has(profile.key)) continue;
    for (const group of (profile.permissions.groups || [])) {
      if (!group.selected) continue;
      try { await client.addQualityProfileGroupPermission(profile.name, profile.language, group.name); }
      catch (error) { logger.debug(`Failed to set profile permission for group ${group.name}: ${error.message}`); }
    }
    for (const user of (profile.permissions.users || [])) {
      if (!user.selected) continue;
      try { await client.addQualityProfileUserPermission(profile.name, profile.language, user.login); }
      catch (error) { logger.debug(`Failed to set profile permission for user ${user.login}: ${error.message}`); }
    }
  }
}
