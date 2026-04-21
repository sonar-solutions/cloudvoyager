// -------- Mark Project Completed --------

export async function doMarkProjectCompleted(withLock, journal, orgKey, projKey, self) {
  return withLock(async () => {
    if (!journal.organizations[orgKey]?.projects?.[projKey]) return;
    journal.organizations[orgKey].projects[projKey].status = 'completed';
    journal.organizations[orgKey].projects[projKey].completedAt = new Date().toISOString();
    await self._saveUnsafe();
  });
}
