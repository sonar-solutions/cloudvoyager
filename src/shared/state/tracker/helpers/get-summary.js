// -------- Get State Summary --------

export function getSummary(state) {
  return {
    lastSync: state.lastSync,
    processedIssuesCount: state.processedIssues.length,
    completedBranchesCount: state.completedBranches.length,
    syncHistoryCount: state.syncHistory.length,
    completedBranches: state.completedBranches,
  };
}
