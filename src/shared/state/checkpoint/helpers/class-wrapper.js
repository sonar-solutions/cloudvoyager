// -------- Backward-Compatible Class Wrapper --------

import { createCheckpointJournal } from '../index.js';

export class CheckpointJournal {
  constructor(journalPath) {
    this._impl = createCheckpointJournal(journalPath);
  }
}

// -------- Delegate Methods --------

const delegatedMethods = [
  'initialize', 'validateFingerprint', 'checkStrictResume',
  'isPhaseCompleted', 'startPhase', 'completePhase', 'failPhase', 'getResumePoint',
  'getBranchStatus', 'startBranch', 'markBranchCompleted', 'markBranchFailed',
  'isBranchPhaseCompleted', 'startBranchPhase', 'failBranchPhase', 'completeBranchPhase',
  'recordUpload', 'getUploadedCeTask',
  'markInterrupted', 'markCompleted', 'save', 'exists', 'clear', 'getData',
];

for (const method of delegatedMethods) {
  CheckpointJournal.prototype[method] = function (...args) {
    return this._impl[method](...args);
  };
}

// -------- Delegate Properties --------

Object.defineProperty(CheckpointJournal.prototype, 'sessionStartTime', {
  get() { return this._impl.sessionStartTime; },
});

Object.defineProperty(CheckpointJournal.prototype, 'journalPath', {
  get() { return this._impl.journalPath; },
});

Object.defineProperty(CheckpointJournal.prototype, 'journal', {
  get() { return this._impl.journal; },
});
