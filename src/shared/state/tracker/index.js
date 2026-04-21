// -------- State Tracker --------
import logger from '../../utils/logger.js';
import { StateStorage } from '../storage.js';
import { LockFile } from '../lock.js';
import { createWriteLock } from '../checkpoint/helpers/with-lock.js';
import { createInitialState } from './helpers/create-initial-state.js';
import { isIssueProcessed, markIssueProcessed } from './helpers/issue-tracking.js';
import { isBranchCompleted, markBranchCompleted } from './helpers/branch-tracking.js';
import { doInitialize } from './helpers/do-initialize.js';
import { getSummary } from './helpers/get-summary.js';

export { createStateTracker };
export { StateTracker } from './helpers/class-wrapper.js';

// -------- Factory Function --------
function createStateTracker(stateFilePath) {
  const storage = new StateStorage(stateFilePath);
  const lock = new LockFile(`${stateFilePath}.lock`);
  const withLock = createWriteLock();
  let state = createInitialState();
  const processedIssuesSet = new Set();
  const completedBranchesSet = new Set();

  const self = {
    get stateFilePath() { return stateFilePath; },
    async initialize(opts = {}) { return doInitialize(storage, lock, state, processedIssuesSet, completedBranchesSet, opts); },
    getLastSync() { return state.lastSync; },
    isIssueProcessed(key) { return isIssueProcessed(processedIssuesSet, key); },
    markIssueProcessed(key) { markIssueProcessed(processedIssuesSet, state.processedIssues, key); },
    markIssuesProcessed(keys) { keys.forEach(k => self.markIssueProcessed(k)); },
    isBranchCompleted(name) { return isBranchCompleted(completedBranchesSet, name); },
    markBranchCompleted(name) { markBranchCompleted(completedBranchesSet, state.completedBranches, name); },
    updateLastSync(ts = null) { state.lastSync = ts || new Date().toISOString(); logger.info(`Last sync updated to: ${state.lastSync}`); },
    addSyncHistory(info) { if (state.syncHistory.length >= 10) { state.syncHistory.shift(); } state.syncHistory.push({ timestamp: new Date().toISOString(), ...info }); },
    async save() { return withLock(async () => { await storage.save(state); }); },
    async saveAfterBranch(name) { return withLock(async () => { self.markBranchCompleted(name); await storage.save(state); logger.debug(`State saved after branch completion: ${name}`); }); },
    async releaseLock() { await lock.release(); },
    async reset() { logger.info('Resetting state...'); state = createInitialState(); processedIssuesSet.clear(); completedBranchesSet.clear(); await storage.clear(); await lock.release(); logger.info('State reset complete'); },
    getSummary() { return getSummary(state); },
    async recordTransfer(stats) { return withLock(async () => { self.updateLastSync(); self.addSyncHistory({ success: true, stats }); await storage.save(state); logger.info('Transfer recorded in state'); }); },
  };
  return self;
}
