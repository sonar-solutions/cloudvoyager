// -------- Mark Project Failed --------

export async function doMarkProjectFailed(withLock, journal, orgKey, projKey, error, self) {
  return withLock(async () => {
    if (!journal.organizations[orgKey]?.projects?.[projKey]) return;
    journal.organizations[orgKey].projects[projKey].status = 'failed';
    journal.organizations[orgKey].projects[projKey].error = error;
    journal.organizations[orgKey].projects[projKey].failedAt = new Date().toISOString();
    await self.save();
  });
}
