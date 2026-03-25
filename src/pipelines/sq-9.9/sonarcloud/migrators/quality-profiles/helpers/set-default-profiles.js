import logger from '../../../../../../shared/utils/logger.js';

// -------- Set Default Quality Profiles --------

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
