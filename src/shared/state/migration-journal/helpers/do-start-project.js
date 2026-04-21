// -------- Start Project --------

import { ensureOrgUnsafe } from './org-tracking.js';

export async function doStartProject(withLock, journal, orgKey, projKey, self) {
  return withLock(async () => {
    ensureOrgUnsafe(journal, orgKey);
    journal.organizations[orgKey].projects[projKey] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      completedSteps: [],
    };
    await self._saveUnsafe();
  });
}
