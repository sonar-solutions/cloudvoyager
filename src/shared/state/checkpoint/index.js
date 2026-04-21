// -------- Checkpoint Journal --------
import logger from '../../utils/logger.js';
import { StateStorage } from '../storage.js';
import { createWriteLock } from './helpers/with-lock.js';
import { validateFingerprint } from './helpers/validate-fingerprint.js';
import { isPhaseCompleted, createStartedPhase, createCompletedPhase, createFailedPhase } from './helpers/phase-tracking.js';
import { getBranchStatus, createStartedBranch, createCompletedBranch, createFailedBranch } from './helpers/branch-tracking.js';
import { isBranchPhaseCompleted, startBranchPhase as doStartBranchPhase, failBranchPhase as doFailBranchPhase } from './helpers/branch-phase-tracking.js';
import { initializeJournal } from './helpers/do-initialize.js';

export { createCheckpointJournal };
export { CheckpointJournal } from './helpers/class-wrapper.js';

// -------- Factory Function --------
function createCheckpointJournal(journalPath) {
  const storage = new StateStorage(journalPath);
  const withLock = createWriteLock();
  let journal = null;

  const self = {
    get journalPath() { return journalPath; },
    get journal() { return journal; },
    get sessionStartTime() { return journal?.sessionFingerprint?.startedAt; },
    async initialize(fp) { return initializeJournal(self, storage, withLock, fp, j => { journal = j; }); },
    async validateFingerprint(current) { validateFingerprint(journal.sessionFingerprint, current, journal.cloudvoyagerVersion); },
    checkStrictResume(strict) { if (strict) logger.info('Strict resume mode: fingerprint validation passed'); },
    isPhaseCompleted(name) { return isPhaseCompleted(journal, name); },
    async startPhase(name) { return withLock(async () => { journal.phases[name] = createStartedPhase(name); await self._saveUnsafe(); }); },
    async completePhase(name, meta) { return withLock(async () => { journal.phases[name] = createCompletedPhase(journal.phases[name], meta); await self._saveUnsafe(); }); },
    async failPhase(name, error) { return withLock(async () => { journal.phases[name] = createFailedPhase(journal.phases[name], error); await self._saveUnsafe(); }); },
    getResumePoint() { for (const [n, p] of Object.entries(journal.phases)) { if (p.status !== 'completed') return n; } return null; },
    getBranchStatus(name) { return getBranchStatus(journal, name); },
    async startBranch(name) { return withLock(async () => { journal.branches[name] = createStartedBranch(); await self._saveUnsafe(); }); },
    async markBranchCompleted(name, ceTaskId = null) { return withLock(async () => { journal.branches[name] = createCompletedBranch(journal.branches[name], ceTaskId); await self._saveUnsafe(); }); },
    async markBranchFailed(name, error) { return withLock(async () => { journal.branches[name] = createFailedBranch(journal.branches[name], error); await self._saveUnsafe(); }); },
    isBranchPhaseCompleted(branch, phase) { return isBranchPhaseCompleted(journal, branch, phase); },
    async startBranchPhase(branch, phase) { return withLock(async () => { doStartBranchPhase(journal, branch, phase); await self._saveUnsafe(); }); },
    async failBranchPhase(branch, phase, error) { return withLock(async () => { doFailBranchPhase(journal, branch, phase, error); await self._saveUnsafe(); }); },
    async completeBranchPhase(branch, phase) { return withLock(async () => { if (journal.branches[branch]?.phases) { journal.branches[branch].phases[phase] = { status: 'completed', completedAt: new Date().toISOString() }; } await self._saveUnsafe(); }); },
    async recordUpload(branch, taskId) { return withLock(async () => { journal.uploadedCeTasks[branch] = { taskId, submittedAt: new Date().toISOString() }; await self._saveUnsafe(); }); },
    getUploadedCeTask(branch) { return journal.uploadedCeTasks[branch] || null; },
    async markInterrupted() { return withLock(async () => { if (journal) { journal.status = 'interrupted'; await self._saveUnsafe(); } }); },
    async markCompleted() { return withLock(async () => { journal.status = 'completed'; journal.completedAt = new Date().toISOString(); await self._saveUnsafe(); }); },
    async _saveUnsafe() { await storage.save(journal); },
    async save() { return withLock(async () => { await storage.save(journal); }); },
    exists() { return storage.exists(); },
    async clear() { await storage.clear(); journal = null; },
    getData() { return journal; },
  };
  return self;
}
