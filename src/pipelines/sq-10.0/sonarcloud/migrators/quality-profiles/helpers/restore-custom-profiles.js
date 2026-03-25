import { buildInheritanceChains } from '../../../../sonarqube/extractors/quality-profiles.js';
import { restoreOneProfile } from './restore-one-profile.js';

// -------- Restore Custom Profiles --------

export async function restoreCustomProfiles(customProfiles, restored, profileMapping, client) {
  const chains = buildInheritanceChains(customProfiles);

  for (const chain of chains) {
    for (const profile of chain) {
      await restoreOneProfile(profile, restored, profileMapping, client);
    }
  }

  for (const profile of customProfiles) {
    await restoreOneProfile(profile, restored, profileMapping, client);
  }
}
