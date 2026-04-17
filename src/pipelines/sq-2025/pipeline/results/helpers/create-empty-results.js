// -------- Create Empty Results --------

/** Create the initial empty results structure for a migration run. */
export function createEmptyResults() {
  return {
    startTime: new Date().toISOString(),
    endTime: null,
    dryRun: false,
    serverSteps: [],
    orgResults: [],
    projects: [],
    qualityGates: 0,
    qualityProfiles: 0,
    groups: 0,
    portfolios: 0,
    portfoliosSkipped: 0,
    issueSyncStats: { matched: 0, transitioned: 0, assigned: 0, assignmentFailed: 0, failedAssignments: [] },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    projectKeyWarnings: [],
    errors: [],
    totalLinesOfCode: 0,
    projectLinesOfCode: [],
    environment: null,
    configuration: null,
  };
}
