// -------- Seed Organizations --------

import { ensureOrgUnsafe } from './org-tracking.js';

export async function doSeedOrganizations(withLock, journal, orgAssignments, self) {
  return withLock(async () => {
    for (const { org, projects } of orgAssignments) {
      ensureOrgUnsafe(journal, org.key);
      const orgEntry = journal.organizations[org.key];
      for (const project of projects) {
        if (!orgEntry.projects[project.key]) {
          orgEntry.projects[project.key] = { status: 'pending' };
        }
      }
    }
    await self._saveUnsafe();
  });
}
