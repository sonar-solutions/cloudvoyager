// -------- Backward-Compatible Class Wrapper --------

import { createStateTracker } from '../index.js';

export class StateTracker {
  constructor(stateFilePath) {
    this._impl = createStateTracker(stateFilePath);
  }
}

// -------- Delegate Methods --------

const delegatedMethods = [
  'initialize', 'getLastSync', 'isIssueProcessed', 'markIssueProcessed',
  'markIssuesProcessed', 'isBranchCompleted', 'markBranchCompleted',
  'updateLastSync', 'addSyncHistory', 'save', 'saveAfterBranch',
  'releaseLock', 'reset', 'getSummary', 'recordTransfer',
];

for (const method of delegatedMethods) {
  StateTracker.prototype[method] = function (...args) {
    return this._impl[method](...args);
  };
}

// -------- Delegate Properties --------

Object.defineProperty(StateTracker.prototype, 'stateFilePath', {
  get() { return this._impl.stateFilePath; },
});
