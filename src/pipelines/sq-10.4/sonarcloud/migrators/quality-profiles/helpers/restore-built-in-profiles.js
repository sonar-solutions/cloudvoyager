import logger from '../../../../../../shared/utils/logger.js';
import { MIGRATED_SUFFIX, renameBuiltInBackupXml } from './rename-built-in-xml.js';

// -------- Main Logic --------

// Restore built-in profiles as custom profiles with a renamed suffix.
export async function restoreBuiltInProfiles(builtInProfiles, restored, profileMapping, builtInProfileMapping, client) {
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
}
