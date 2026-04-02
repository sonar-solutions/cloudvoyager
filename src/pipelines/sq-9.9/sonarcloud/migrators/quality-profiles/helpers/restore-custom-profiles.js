import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';
import { buildInheritanceChains } from '../../../../sonarqube/extractors/quality-profiles.js';
import { restoreOneProfile } from './restore-one-profile.js';

// -------- Restore Custom Profiles (with inheritance chains) --------

export async function restoreCustomProfiles(customProfiles, restored, profileMapping, client) {
  const chains = buildInheritanceChains(customProfiles);

  await mapConcurrent(chains, async (chain) => {
    for (const profile of chain) await restoreOneProfile(profile, restored, profileMapping, client);
  }, { concurrency: 5 });

  await mapConcurrent(customProfiles, async (profile) => {
    await restoreOneProfile(profile, restored, profileMapping, client);
  }, { concurrency: 5 });
}
