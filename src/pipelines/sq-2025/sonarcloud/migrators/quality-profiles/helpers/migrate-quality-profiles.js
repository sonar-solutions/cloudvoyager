import logger from '../../../../../../shared/utils/logger.js';
import { buildInheritanceChains } from '../../../../sonarqube/extractors/quality-profiles.js';
import { restoreProfileChains, restoreRemainingProfiles } from './restore-profiles.js';
import { restoreBuiltInProfiles } from './restore-builtin-profiles.js';
import { setDefaultProfiles, setProfilePermissions } from './set-profile-permissions.js';

// -------- Migrate Quality Profiles --------

/** Migrate quality profiles from SonarQube to SonarCloud. */
export async function migrateQualityProfiles(extractedProfiles, client) {
  const profileMapping = new Map();
  const builtInProfileMapping = new Map();
  const customProfiles = extractedProfiles.filter(p => !p.isBuiltIn);
  const builtInProfiles = extractedProfiles.filter(p => p.isBuiltIn);

  logger.info(`Migrating ${customProfiles.length} custom + ${builtInProfiles.length} built-in quality profiles`);
  const restored = new Set();

  const chains = buildInheritanceChains(customProfiles);
  await restoreProfileChains(chains, restored, profileMapping, client);
  await restoreRemainingProfiles(customProfiles, restored, profileMapping, client);
  await restoreBuiltInProfiles(builtInProfiles, restored, profileMapping, builtInProfileMapping, client);
  await setDefaultProfiles(extractedProfiles, restored, client, builtInProfiles);
  await setProfilePermissions(customProfiles, restored, client);

  return { profileMapping, builtInProfileMapping };
}
