// -------- Create Initial State --------

/**
 * Create a fresh state tracker state object.
 * @returns {object} Initial state
 */
export function createInitialState() {
  return {
    lastSync: null,
    processedIssues: [],
    completedBranches: [],
    syncHistory: [],
  };
}
