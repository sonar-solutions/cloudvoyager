// -------- Create Empty Issue Result --------

/** Create a fresh empty result object for issue verification. */
export function createEmptyIssueResult() {
  return {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    matched: 0,
    unmatched: 0,
    statusMismatches: [],
    statusHistoryMismatches: [],
    assignmentMismatches: [],
    commentMismatches: [],
    tagMismatches: [],
    typeBreakdown: { sq: {}, sc: {} },
    severityBreakdown: { sq: {}, sc: {} },
    unmatchedSqIssues: [],
    scOnlyIssues: [],
    unsyncable: {
      typeChanges: 0,
      severityChanges: 0,
      typeChangeDetails: [],
      severityChangeDetails: [],
    },
  };
}
