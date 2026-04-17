// -------- Create Sync Stats --------

/** Create a fresh stats object for issue sync tracking. */
export function createSyncStats() {
  return {
    filtered: 0,
    matched: 0,
    transitioned: 0,
    assigned: 0,
    assignmentFailed: 0,
    assignmentSkipped: 0,
    assignmentMapped: 0,
    failedAssignments: [],
    commented: 0,
    tagged: 0,
    metadataSyncTagged: 0,
    sourceLinked: 0,
    failed: 0,
  };
}
