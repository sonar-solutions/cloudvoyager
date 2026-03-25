// -------- Migration Journal --------

import { StateStorage } from '../storage.js';
import { createWriteLock } from './helpers/with-lock.js';
import { ensureOrgUnsafe, isOrgWideCompleted } from './helpers/org-tracking.js';
import { getProjectStatus, getProjectLastStep, isProjectStepCompleted } from './helpers/project-tracking.js';
import { doInitialize } from './helpers/do-initialize.js';
import { doSeedOrganizations } from './helpers/do-seed-organizations.js';
import { doStartProject } from './helpers/do-start-project.js';
import { doCompleteStep } from './helpers/do-complete-step.js';
import { doMarkProjectCompleted } from './helpers/do-mark-project-completed.js';
import { doMarkProjectFailed } from './helpers/do-mark-project-failed.js';

export { createMigrationJournal };
export { MigrationJournal } from './helpers/class-wrapper.js';

// -------- Factory Function --------

function createMigrationJournal(journalPath) {
  const storage = new StateStorage(journalPath);
  const withLock = createWriteLock();
  let journal = null;

  const self = {
    get journalPath() { return journalPath; },
    get journal() { return journal; },
    async initialize(meta = {}) { return doInitialize(storage, withLock, meta, self, j => { journal = j; }); },
    async seedOrganizations(orgAssignments) { return doSeedOrganizations(withLock, journal, orgAssignments, self); },
    async ensureOrg(orgKey) { return withLock(async () => { ensureOrgUnsafe(journal, orgKey); await self.save(); }); },
    isOrgWideCompleted(orgKey) { return isOrgWideCompleted(journal, orgKey); },
    async markOrgWideCompleted(orgKey) { return withLock(async () => { ensureOrgUnsafe(journal, orgKey); journal.organizations[orgKey].orgWideResources = 'completed'; journal.organizations[orgKey].status = 'in_progress'; await self.save(); }); },
    async markOrgCompleted(orgKey) { return withLock(async () => { if (journal.organizations[orgKey]) { journal.organizations[orgKey].status = 'completed'; journal.organizations[orgKey].completedAt = new Date().toISOString(); await self.save(); } }); },
    getProjectStatus(orgKey, projKey) { return getProjectStatus(journal, orgKey, projKey); },
    getProjectLastStep(orgKey, projKey) { return getProjectLastStep(journal, orgKey, projKey); },
    isProjectStepCompleted(orgKey, projKey, step, order) { return isProjectStepCompleted(journal, orgKey, projKey, step, order); },
    async startProject(orgKey, projKey) { return doStartProject(withLock, journal, orgKey, projKey, self); },
    async completeProjectStep(orgKey, projKey, step) { return doCompleteStep(withLock, journal, orgKey, projKey, step, self); },
    async markProjectCompleted(orgKey, projKey) { return doMarkProjectCompleted(withLock, journal, orgKey, projKey, self); },
    async markProjectFailed(orgKey, projKey, error) { return doMarkProjectFailed(withLock, journal, orgKey, projKey, error, self); },
    async markInterrupted() { return withLock(async () => { if (journal) { journal.status = 'interrupted'; await self.save(); } }); },
    async markCompleted() { return withLock(async () => { journal.status = 'completed'; journal.completedAt = new Date().toISOString(); await self.save(); }); },
    async save() { await storage.save(journal); },
    exists() { return storage.exists(); },
    async peek() { return storage.load(); },
    async clear() { await storage.clear(); journal = null; },
    getData() { return journal; },
  };

  return self;
}
