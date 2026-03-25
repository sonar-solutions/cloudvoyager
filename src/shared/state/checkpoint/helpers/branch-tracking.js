// -------- Branch Tracking Methods --------

// Get branch status
export function getBranchStatus(journal, branchName) {
  return journal.branches[branchName]?.status;
}

// Create a started branch entry
export function createStartedBranch() {
  return {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    phases: {},
  };
}

// Create a completed branch entry
export function createCompletedBranch(existingBranch, ceTaskId) {
  return {
    ...existingBranch,
    status: 'completed',
    completedAt: new Date().toISOString(),
    ceTaskId,
  };
}

// Create a failed branch entry
export function createFailedBranch(existingBranch, error) {
  return {
    ...existingBranch,
    status: 'failed',
    failedAt: new Date().toISOString(),
    error,
  };
}
