// -------- Progress Tracker --------
import { createProgressTracker } from './helpers/create-progress-tracker.js';

export function createProgressTrackerInstance(stateFilePath) {
  return createProgressTracker(stateFilePath);
}

export class ProgressTracker {
  constructor(stateFilePath) {
    this._impl = createProgressTracker(stateFilePath);
  }
  displayStatus() { return this._impl.displayStatus(); }
  displayMigrationStatus(p) { return this._impl.displayMigrationStatus(p); }
  getCompletionPercentage(j) { return this._impl.getCompletionPercentage(j); }
  getEstimatedTimeRemaining(j) { return this._impl.getEstimatedTimeRemaining(j); }
}
