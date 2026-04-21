// -------- Create Progress Tracker Factory --------
import { displayCheckpointStatus } from './display-checkpoint-status.js';
import { displayMigrationStatus } from './display-migration-status.js';
import { getCompletionPercentage } from './get-completion-percentage.js';
import { getEstimatedTimeRemaining } from './get-estimated-time-remaining.js';

export function createProgressTracker(stateFilePath) {
  const journalPath = `${stateFilePath}.journal`;

  return {
    displayStatus: () => displayCheckpointStatus(journalPath),
    displayMigrationStatus: (p) => displayMigrationStatus(p),
    getCompletionPercentage: (j) => getCompletionPercentage(j),
    getEstimatedTimeRemaining: (j) => getEstimatedTimeRemaining(j)
  };
}
