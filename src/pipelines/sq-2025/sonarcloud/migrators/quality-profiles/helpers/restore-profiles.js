import logger from '../../../../../../shared/utils/logger.js';

// -------- Restore Profiles --------

/** Restore a single profile via backup XML. */
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

/** Restore profiles in inheritance chain order. */
export async function restoreProfileChains(chains, restored, profileMapping, client) {
  for (const chain of chains) {
    for (const profile of chain) await restoreOneProfile(profile, restored, profileMapping, client);
  }
}

/** Restore any remaining custom profiles not already restored via chains. */
export async function restoreRemainingProfiles(customProfiles, restored, profileMapping, client) {
  for (const profile of customProfiles) await restoreOneProfile(profile, restored, profileMapping, client);
}
