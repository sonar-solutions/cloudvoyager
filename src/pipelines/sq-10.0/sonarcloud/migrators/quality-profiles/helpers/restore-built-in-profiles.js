import logger from '../../../../../../shared/utils/logger.js';
import { MIGRATED_SUFFIX, renameBuiltInBackupXml } from './rename-built-in-backup.js';

// -------- Restore Built-In Profiles --------

export async function restoreBuiltInProfiles(builtInProfiles, restored, profileMapping, builtInProfileMapping, client) {
  let existingScProfiles = [];
  try { existingScProfiles = await client.searchQualityProfiles() || []; }
  catch (error) { logger.debug(`Could not fetch existing SC profiles for dedup check: ${error.message}`); }

  const existingNames = new Set(existingScProfiles.map(p => `${p.language}:${p.name}`));

  for (const profile of builtInProfiles) {
    if (!profile.backupXml) { logger.warn(`No backup XML for built-in profile ${profile.name} (${profile.language}), skipping`); continue; }

    const migratedName = profile.name + MIGRATED_SUFFIX;
    if (existingNames.has(`${profile.language}:${migratedName}`)) {
      logger.info(`Built-in profile already migrated: ${migratedName} (${profile.language}), skipping restore`);
      profileMapping.set(profile.key, migratedName);
      builtInProfileMapping.set(profile.language, migratedName);
      restored.add(profile.key);
      continue;
    }

    const renamedXml = renameBuiltInBackupXml(profile.backupXml, profile.name);
    try {
      await client.restoreQualityProfile(renamedXml);
      profileMapping.set(profile.key, migratedName);
      builtInProfileMapping.set(profile.language, migratedName);
      restored.add(profile.key);
      logger.info(`Restored built-in profile as custom: ${migratedName} (${profile.language})`);
    } catch (error) { logger.warn(`Failed to restore built-in profile ${profile.name} (${profile.language}): ${error.message}`); }
  }
}
