// -------- Phase Tracking Methods --------

// Check if a phase has been completed
export function isPhaseCompleted(journal, phaseName) {
  return journal.phases[phaseName]?.status === 'completed';
}

// Create a started phase entry
export function createStartedPhase(phaseName) {
  return {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  };
}

// Create a completed phase entry, preserving startedAt
export function createCompletedPhase(existingPhase, meta = {}) {
  return {
    status: 'completed',
    completedAt: new Date().toISOString(),
    ...(existingPhase?.startedAt ? { startedAt: existingPhase.startedAt } : {}),
    ...meta,
  };
}

// Create a failed phase entry
export function createFailedPhase(existingPhase, error) {
  return {
    ...existingPhase,
    status: 'failed',
    failedAt: new Date().toISOString(),
    error,
  };
}
