import logger from '../../../../../../shared/utils/logger.js';

// -------- Extract Quality Profiles with Backup and Permissions --------

export async function extractQualityProfiles(client) {
  const profiles = await client.getAllQualityProfiles();
  logger.info(`Found ${profiles.length} quality profiles`);

  const detailed = [];
  for (const profile of profiles) {
    let backupXml = null;
    try {
      backupXml = await client.getQualityProfileBackup(profile.language, profile.name);
    } catch (error) {
      logger.warn(`Failed to backup profile ${profile.name} (${profile.language}): ${error.message}`);
    }

    const permissions = await client.getQualityProfilePermissions(profile.language, profile.name);

    detailed.push({
      key: profile.key, name: profile.name, language: profile.language,
      languageName: profile.languageName, isDefault: profile.isDefault || false,
      isBuiltIn: profile.isBuiltIn || false, parentKey: profile.parentKey || null,
      parentName: profile.parentName || null, activeRuleCount: profile.activeRuleCount || 0,
      activeDeprecatedRuleCount: profile.activeDeprecatedRuleCount || 0,
      rulesUpdatedAt: profile.rulesUpdatedAt, backupXml, permissions
    });
  }

  return detailed;
}
