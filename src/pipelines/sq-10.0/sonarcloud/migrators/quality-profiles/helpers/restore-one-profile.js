import logger from '../../../../../../shared/utils/logger.js';

// -------- Restore One Profile --------

export async function restoreOneProfile(profile, restored, profileMapping, client) {
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
