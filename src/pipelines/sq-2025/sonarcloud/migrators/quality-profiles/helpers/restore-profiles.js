import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

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

/** Restore profiles in inheritance chain order (parallel across chains, sequential within). */
export async function restoreProfileChains(chains, restored, profileMapping, client) {
  await mapConcurrent(chains, async (chain) => {
    for (const profile of chain) await restoreOneProfile(profile, restored, profileMapping, client);
  }, { concurrency: 5 });
}

/** Restore any remaining custom profiles not already restored via chains. */
export async function restoreRemainingProfiles(customProfiles, restored, profileMapping, client) {
  await mapConcurrent(customProfiles, async (profile) => {
    await restoreOneProfile(profile, restored, profileMapping, client);
  }, { concurrency: 5 });
}
