import logger from '../../../../../../shared/utils/logger.js';

// -------- Set Profile Permissions --------

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
