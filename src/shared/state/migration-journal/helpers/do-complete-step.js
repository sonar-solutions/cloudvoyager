// -------- Complete Project Step --------

export async function doCompleteStep(withLock, journal, orgKey, projKey, step, self) {
  return withLock(async () => {
    const project = journal.organizations[orgKey]?.projects?.[projKey];
    if (!project) return;
    if (!project.completedSteps) project.completedSteps = [];
    if (!project.completedSteps.includes(step)) project.completedSteps.push(step);
    await self.save();
  });
}
