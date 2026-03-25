// -------- Backward-Compatible Class Wrapper --------

import { createMigrationJournal } from '../index.js';

export class MigrationJournal {
  constructor(journalPath) {
    this._impl = createMigrationJournal(journalPath);
  }
}

// -------- Delegate Methods --------

const delegatedMethods = [
  'initialize', 'seedOrganizations', 'ensureOrg',
  'isOrgWideCompleted', 'markOrgWideCompleted', 'markOrgCompleted',
  'getProjectStatus', 'getProjectLastStep', 'isProjectStepCompleted',
  'startProject', 'completeProjectStep', 'markProjectCompleted', 'markProjectFailed',
  'markInterrupted', 'markCompleted', 'save', 'exists', 'peek', 'clear', 'getData',
];

for (const method of delegatedMethods) {
  MigrationJournal.prototype[method] = function (...args) {
    return this._impl[method](...args);
  };
}

// -------- Delegate Properties --------

Object.defineProperty(MigrationJournal.prototype, 'journalPath', {
  get() { return this._impl.journalPath; },
});

Object.defineProperty(MigrationJournal.prototype, 'journal', {
  get() { return this._impl.journal; },
});
