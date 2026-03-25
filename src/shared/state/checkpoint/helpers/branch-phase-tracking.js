// -------- Branch Phase Tracking --------

// Check if a branch phase is completed
export function isBranchPhaseCompleted(journal, branchName, phaseName) {
  return journal.branches[branchName]?.phases?.[phaseName]?.status === 'completed';
}

// Ensure branch and phases objects exist, then set a phase to in_progress
export function startBranchPhase(journal, branchName, phaseName) {
  if (!journal.branches[branchName]) {
    journal.branches[branchName] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      phases: {},
    };
  }
  if (!journal.branches[branchName].phases) {
    journal.branches[branchName].phases = {};
  }
  journal.branches[branchName].phases[phaseName] = {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  };
}

// Mark a branch phase as failed
export function failBranchPhase(journal, branchName, phaseName, error) {
  if (!journal.branches[branchName]?.phases) return;
  journal.branches[branchName].phases[phaseName] = {
    ...journal.branches[branchName].phases[phaseName],
    status: 'failed',
    failedAt: new Date().toISOString(),
    error,
  };
}
