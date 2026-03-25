import logger from '../../../../../shared/utils/logger.js';
import { restoreCustomProfiles } from './helpers/restore-custom-profiles.js';
import { restoreBuiltInProfiles } from './helpers/restore-built-in-profiles.js';
import { setDefaultProfiles } from './helpers/set-default-profiles.js';
import { setProfilePermissions } from './helpers/set-profile-permissions.js';

// -------- Migrate Quality Profiles --------

export async function migrateQualityProfiles(extractedProfiles, client) {
  const profileMapping = new Map();
  const builtInProfileMapping = new Map();

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
