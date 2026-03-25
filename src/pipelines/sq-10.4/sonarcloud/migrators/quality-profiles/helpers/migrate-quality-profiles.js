import logger from '../../../../../../shared/utils/logger.js';
import { restoreCustomProfiles } from './restore-custom-profiles.js';
import { restoreBuiltInProfiles } from './restore-built-in-profiles.js';
import { setDefaultProfiles } from './set-profile-defaults.js';
import { setProfilePermissions } from './set-profile-permissions.js';

// -------- Main Logic --------

// Migrate quality profiles from SonarQube to SonarCloud using backup/restore.
export async function migrateQualityProfiles(extractedProfiles, client) {
  const profileMapping = new Map(), builtInProfileMapping = new Map();
  const customProfiles = extractedProfiles.filter(p => !p.isBuiltIn);
  const builtInProfiles = extractedProfiles.filter(p => p.isBuiltIn);
  const restored = new Set();

  logger.info(`Migrating ${customProfiles.length} custom + ${builtInProfiles.length} built-in quality profiles`);

  await restoreCustomProfiles(customProfiles, restored, profileMapping, client);
  await restoreBuiltInProfiles(builtInProfiles, restored, profileMapping, builtInProfileMapping, client);
  await setDefaultProfiles(extractedProfiles, restored, client, builtInProfiles);
  await setProfilePermissions(customProfiles, restored, client);

  return { profileMapping, builtInProfileMapping };
}
